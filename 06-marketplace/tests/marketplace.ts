import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Marketplace } from "../target/types/marketplace";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
  createVerifyCollectionInstruction,
  DataV2,
} from "@metaplex-foundation/mpl-token-metadata";

describe("marketplace", () => {
  // Configure the client
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.Marketplace as Program<Marketplace>;

  // Helper for logging transaction URLs
  const log = async (signature: string): Promise<string> => {
    console.log(
      `Transaction: https://explorer.solana.com/transaction/${signature}?cluster=devnet`,
    );
    return signature;
  };

  // Generate necessary keypairs
  const admin = Keypair.generate();
  const maker = Keypair.generate();
  const taker = Keypair.generate();
  const collectionMint = Keypair.generate();
  const nftMint = Keypair.generate();

  // Marketplace constants
  const marketplaceName = "Test Marketplace";
  const marketplaceFee = 250; // 2.5%

  // Find PDAs
  const [marketplace] = PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), Buffer.from(marketplaceName)],
    program.programId,
  );

  const [treasury] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), marketplace.toBuffer()],
    program.programId,
  );

  const [rewardMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards"), marketplace.toBuffer()],
    program.programId,
  );

  const [listing] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("listing"),
      marketplace.toBuffer(),
      nftMint.publicKey.toBuffer(),
    ],
    program.programId,
  );

  // Initialize token accounts
  const makerNftAta = getAssociatedTokenAddressSync(
    nftMint.publicKey,
    maker.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const takerNftAta = getAssociatedTokenAddressSync(
    nftMint.publicKey,
    taker.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const vault = getAssociatedTokenAddressSync(
    nftMint.publicKey,
    listing,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  const takerRewardsAta = getAssociatedTokenAddressSync(
    rewardMint,
    taker.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  // Find metadata PDAs
  const [collectionMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      collectionMint.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID,
  );

  const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      collectionMint.publicKey.toBuffer(),
      Buffer.from("edition"),
    ],
    METADATA_PROGRAM_ID,
  );

  const [nftMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      nftMint.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID,
  );

  const [nftMasterEdition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      nftMint.publicKey.toBuffer(),
      Buffer.from("edition"),
    ],
    METADATA_PROGRAM_ID,
  );

  before(async () => {
    // Airdrop SOL to admin and users
    await Promise.all(
      [admin, maker, taker].map((kp) =>
        provider.connection.requestAirdrop(
          kp.publicKey,
          100 * LAMPORTS_PER_SOL,
        ),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for confirmation
  });

  it("Create collection and NFT", async () => {
    // Collection metadata
    const collectionMetadataData: DataV2 = {
      name: "Test Collection",
      symbol: "TEST",
      uri: "https://test.uri/collection.json",
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };

    // NFT metadata
    const nftMetadataData: DataV2 = {
      name: "Test NFT",
      symbol: "TEST",
      uri: "https://test.uri/nft.json",
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: {
        key: collectionMint.publicKey,
        verified: false,
      },
      uses: null,
    };

    // Create collection mint
    const collectionTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: admin.publicKey,
        newAccountPubkey: collectionMint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        collectionMint.publicKey,
        0,
        admin.publicKey,
        admin.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: collectionMetadata,
          mint: collectionMint.publicKey,
          mintAuthority: admin.publicKey,
          payer: admin.publicKey,
          updateAuthority: admin.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: collectionMetadataData,
            isMutable: true,
            collectionDetails: { __kind: "V1", size: 0 },
          },
        },
      ),
      createCreateMasterEditionV3Instruction(
        {
          edition: collectionMasterEdition,
          mint: collectionMint.publicKey,
          updateAuthority: admin.publicKey,
          mintAuthority: admin.publicKey,
          payer: admin.publicKey,
          metadata: collectionMetadata,
        },
        {
          createMasterEditionArgs: {
            maxSupply: 0,
          },
        },
      ),
    );

    // Create NFT mint
    const nftTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: maker.publicKey,
        newAccountPubkey: nftMint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        nftMint.publicKey,
        0,
        maker.publicKey,
        maker.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: nftMetadata,
          mint: nftMint.publicKey,
          mintAuthority: maker.publicKey,
          payer: maker.publicKey,
          updateAuthority: maker.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: nftMetadataData,
            isMutable: true,
            collectionDetails: null,
          },
        },
      ),
      createCreateMasterEditionV3Instruction(
        {
          edition: nftMasterEdition,
          mint: nftMint.publicKey,
          updateAuthority: maker.publicKey,
          mintAuthority: maker.publicKey,
          payer: maker.publicKey,
          metadata: nftMetadata,
        },
        {
          createMasterEditionArgs: {
            maxSupply: 0,
          },
        },
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        maker.publicKey,
        makerNftAta,
        maker.publicKey,
        nftMint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createMintToInstruction(
        nftMint.publicKey,
        makerNftAta,
        maker.publicKey,
        1,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
      createVerifyCollectionInstruction({
        metadata: nftMetadata,
        collectionAuthority: admin.publicKey,
        payer: admin.publicKey,
        collectionMint: collectionMint.publicKey,
        collection: collectionMetadata,
        collectionMasterEditionAccount: collectionMasterEdition,
      }),
    );

    await provider
      .sendAndConfirm(collectionTx, [admin, collectionMint])
      .then(log);
    await provider.sendAndConfirm(nftTx, [maker, nftMint, admin]).then(log);
  });

  it("Initialize marketplace", async () => {
    await program.methods
      .initialize(marketplaceName, marketplaceFee)
      .accounts({
        admin: admin.publicKey,
        marketplace,
        treasury,
        rewardMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc()
      .then(log);
  });

  it("List NFT", async () => {
    const price = new anchor.BN(1 * LAMPORTS_PER_SOL);

    await program.methods
      .list(price)
      .accounts({
        maker: maker.publicKey,
        marketplace,
        makerMint: nftMint.publicKey,
        makerAta: makerNftAta,
        vault,
        listing,
        collectionMint: collectionMint.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc()
      .then(log);
  });

  it("Delist NFT", async () => {
    await program.methods
      .delist()
      .accounts({
        maker: maker.publicKey,
        marketplace,
        makerMint: nftMint.publicKey,
        makerAta: makerNftAta,
        vault,
        listing,
        collectionMint: collectionMint.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc()
      .then(log);
  });

  it("List NFT again", async () => {
    const price = new anchor.BN(1.5 * LAMPORTS_PER_SOL);

    await program.methods
      .list(price)
      .accounts({
        taker: taker.publicKey,
        maker: maker.publicKey,
        marketplace,
        makerMint: nftMint.publicKey,
        takerAta: takerNftAta,
        takerRewardsAta,
        rewardMint,
        vault,
        listing,
        treasury,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc()
      .then(log);
  });

  it("Purchase NFT", async () => {
    await program.methods
      .purchase()
      .accounts({
        taker: taker.publicKey,
        maker: maker.publicKey,
        makerMint: nftMint.publicKey,
      })
      .signers([taker])
      .rpc()
      .then(log);
  });
});
