import bs58 from "bs58";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function base58ToWallet() {
  rl.question("Enter your Base58 string: ", (base58String) => {
    try {
      const wallet = new Uint8Array(bs58.decode(base58String as string));
      console.log("Wallet:", wallet);
    } catch (error) {
      console.error("Invalid Base58 string:", error);
    }
    rl.close();
  });
}

function walletToBase58() {
  rl.question(
    "Enter your wallet (as a comma-separated list of bytes): ",
    (walletInput) => {
      try {
        // Remove square brackets if present
        const sanitizedInput = walletInput.trim().replace(/^\[|\]$/g, "");

        // Split the input into an array of bytes
        const walletArray = sanitizedInput.split(",").map((byte: string) => {
          const num = Number(byte.trim());
          if (isNaN(num) || num < 0 || num > 255) {
            throw new Error(`Invalid byte value: ${byte}`);
          }
          return num;
        });

        // Convert to Uint8Array and encode to Base58
        const wallet = new Uint8Array(walletArray);
        const base58 = bs58.encode(wallet as Uint8Array);
        console.log("Base58:", base58);
      } catch (error) {
        console.error("Invalid wallet format:", error);
      }
      rl.close();
    },
  );
}

const commands = {
  "base58-to-wallet": base58ToWallet,
  "wallet-to-base58": walletToBase58,
};

if (process.argv.length < 3) {
  console.error("Usage: node <script-name> <command>");
  console.error("Available commands:", Object.keys(commands).join(", "));
  process.exit(1);
}

const command = process.argv[2];
if (!(command in commands)) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

commands[command as keyof typeof commands]();
