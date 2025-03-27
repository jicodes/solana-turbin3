mod programs;

#[cfg(test)]
mod tests {
    use solana_sdk::{
        message::Message,
        signature::{read_keypair_file, Keypair, Signer},
        system_program,
        transaction::Transaction,
    };

    use std::io::{self, BufRead};

    use solana_client::rpc_client::RpcClient;

    use solana_program::{pubkey::Pubkey, system_instruction::transfer};

    use std::str::FromStr;

    use crate::programs::turbin3_prereq::{CompleteArgs, Turbin3PrereqProgram};

    const RPC_URL: &str = "https://api.devnet.solana.com";

    #[test]
    fn keygen() {
        // Create a new keypair
        let kp = Keypair::new();
        println!("You've generated a new Solana wallet: {}", kp.pubkey());
        println!();
        println!("To save your wallet, copy and paste the following into a JSON file:");
        println!("{:?}", kp.to_bytes());
    }

    #[test]
    fn base58_to_wallet() {
        println!("Input your private key as base58:");
        let stdin = io::stdin();
        let base58 = stdin.lock().lines().next().unwrap().unwrap();
        println!("Your wallet file is:");
        let wallet = bs58::decode(base58).into_vec().unwrap();
        println!("{:?}", wallet);
    }

    #[test]
    fn wallet_to_base58() {
        println!("Input your private key as a wallet file byte array:");
        let stdin = io::stdin();
        let wallet = stdin
            .lock()
            .lines()
            .next()
            .unwrap()
            .unwrap()
            .trim_start_matches('[')
            .trim_end_matches(']')
            .split(',')
            .map(|s| s.trim().parse::<u8>().unwrap())
            .collect::<Vec<u8>>();
        println!("Your private key is:");
        let base58 = bs58::encode(wallet).into_string();
        println!("{:?}", base58);
    }

    #[test]
    fn airdrop() {
        // Import our keypair
        let keypair = read_keypair_file("dev-wallet.json").expect("Couldn't find wallet file");

        // Connected to Solana Devnet RPC Client
        let client = RpcClient::new(RPC_URL);

        // We're going to claim 2 devnet SOL tokens (2 billion lamports)
        match client.request_airdrop(&keypair.pubkey(), 2_000_000_000u64) {
            Ok(sig) => {
                println!("Success! Check out your TX here:");
                println!("https://explorer.solana.com/tx/{}?cluster=devnet", sig);
            }
            Err(e) => println!("Oops, something went wrong: {}", e),
        };
    }

    #[test]
    fn transfer_sol() {
        // Import our keypair
        let keypair = read_keypair_file("dev-wallet.json").expect("Couldn't find wallet file");

        // With the imported Keypair, we can sign a new message.
        let pubkey = keypair.pubkey();
        let message_bytes = b"I verify my solana Keypair!";
        let sig = keypair.sign_message(message_bytes);
        // After that we can verify the singature, using the default implementation
        match sig.verify(&pubkey.to_bytes(), message_bytes) {
            true => println!("Signature verified"),
            false => println!("Verification failed"),
        }

        // Define our Turbin3 public key
        let to_pubkey = Pubkey::from_str("<your Turbin3 public key>").unwrap();

        // Create a Solana devnet connection
        let rpc_client = RpcClient::new(RPC_URL);

        // In order to sign transactions, we're going to need to get a recent blockhash,
        // as signatures are designed to expire as a security feature:

        // Get recent blockhash
        let recent_blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        // Create a new transaction
        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, 100_000_000)],
            Some(&keypair.pubkey()),
            &vec![&keypair],
            recent_blockhash,
        );

        // Send the transaction
        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        // Print our transaction out
        println!(
            "Success! Check out your TX here: https://explorer.solana.com/tx/{}/?cluster=devnet",
            signature
        );
    }

    #[test]
    fn empty_sol() {
        // Create a Solana devnet connection
        let rpc_client = RpcClient::new(RPC_URL);

        // Import our keypair
        let keypair = read_keypair_file("dev-wallet.json").expect("Couldn't find wallet file");

        // Get balance of dev wallet
        let balance = rpc_client
            .get_balance(&keypair.pubkey())
            .expect("Failed to get balance");

        // Define our Turbin3 public key
        let to_pubkey = Pubkey::from_str("<your Turbin3 public key>").unwrap();

        // Get recent blockhash
        let recent_blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        // Create a test transaction to calculate fees
        let message = Message::new_with_blockhash(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance)],
            Some(&keypair.pubkey()),
            &recent_blockhash,
        );

        // Calculate exact fee rate to transfer entire SOL amount out of account minus fees
        let fee = rpc_client
            .get_fee_for_message(&message)
            .expect("Failed to get fee calculator");

        // Deduct fee from lamports amount and create a TX with correct balance
        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance - fee)],
            Some(&keypair.pubkey()),
            &vec![&keypair],
            recent_blockhash,
        );

        // Send the transaction
        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        // Print our transaction out
        println!(
            "Success! Check out your TX here: https://explorer.solana.com/tx/{}/?cluster=devnet",
            signature
        );
    }

    #[test]
    fn enroll() {
        // Create a Solana devnet connection
        let rpc_client = RpcClient::new(RPC_URL);
        // Import the Turbin3 keypair as singer
        let signer = read_keypair_file("turbin3-wallet.json").expect("Couldn't find wallet file");

        // Create PDA for "prereq" account
        let prereq = Turbin3PrereqProgram::derive_program_address(&[
            b"prereq",
            signer.pubkey().to_bytes().as_ref(),
        ]);

        // Define our instruction data
        let args = CompleteArgs {
            github: b"jicodes".to_vec(),
        };

        // Get recent blockhash
        let blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Failed to get recent blockhash");

        // Now we can invoke the "complete" function
        let transaction = Turbin3PrereqProgram::complete(
            &[&signer.pubkey(), &prereq, &system_program::id()],
            &args,
            Some(&signer.pubkey()),
            &[&signer],
            blockhash,
        );

        // Send the transaction
        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        // Print our transaction out
        println!(
            "Success! Check out your TX here:
https://explorer.solana.com/tx/{}/?cluster=devnet",
            signature
        );
    }
}
