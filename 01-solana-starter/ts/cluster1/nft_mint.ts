import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createSignerFromKeypair, signerIdentity, generateSigner, percentAmount } from "@metaplex-foundation/umi"
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";

import wallet from "../dev-wallet.json"
import base58 from "bs58";

const RPC_ENDPOINT = "https://api.devnet.solana.com";
const umi = createUmi(RPC_ENDPOINT);

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const myKeypairSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(myKeypairSigner));
umi.use(mplTokenMetadata())

const mint = generateSigner(umi);
const metadata_uri = "https://devnet.irys.xyz/C8RMsKS1zs8b4UPuotDcfZpyWqFrucTV9nUD7fM9tixQ";

(async () => {
    let tx = createNft(umi, {
        mint,
        name: "Rug Day NFT",
        symbol: "RUG",
        uri: metadata_uri, 
        sellerFeeBasisPoints: percentAmount(0), // % royalty
        creators: [{
            address: keypair.publicKey,
            verified: true,
            share: 100
        }]
    });
    let result = await tx.sendAndConfirm(umi);
    const signature = base58.encode(result.signature);
    
    console.log(`Succesfully Minted! Check out your TX here:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`)

    console.log("Mint Address: ", mint.publicKey);
})();