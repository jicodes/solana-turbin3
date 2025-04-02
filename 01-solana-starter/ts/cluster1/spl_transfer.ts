import { Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import wallet from "../dev-wallet.json"
import to_wallet from "../dev2-wallet.json"
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// We're going to import our keypair from the wallet file
const fromKeypair = Keypair.fromSecretKey(new Uint8Array(wallet));
const toKeypair = Keypair.fromSecretKey(new Uint8Array(to_wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

// Mint address
const mint = new PublicKey("vC8rsREzMEhtE5ckw5UHUQXJCKXGHCFCWpuQu5Adahg");

(async () => {
    try {
        // Get the token account of the fromWallet address, and if it does not exist, create it
        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            fromKeypair,
            mint,
            fromKeypair.publicKey
        );
        console.log("Sender token account:", fromTokenAccount.address.toBase58());

        // Get the token account of the toWallet address, and if it does not exist, create it
        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            fromKeypair, 
            mint,
            toKeypair.publicKey
        );
        console.log("Recipient token account:", toTokenAccount.address.toBase58());

        const amount = 1 * 10 ** 6; // 1 token (6 decimals)
        
        // Transfer the new token to the "toTokenAccount" we just created
        const signature = await transfer(
            connection,
            fromKeypair,
            fromTokenAccount.address,
            toTokenAccount.address,
            fromKeypair.publicKey,
            amount
        );
        console.log(`Transfer successful! Signature: ${signature}`);
    } catch(e) {
        console.error(`Oops, something went wrong: ${e}`)
    }
})();