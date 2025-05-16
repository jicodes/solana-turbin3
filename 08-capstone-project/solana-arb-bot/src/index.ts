import "dotenv/config";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import axios from "axios";
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionInstruction,
  Transaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import bs58 from "bs58";
import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import idl from "./idl/arbcheck.json";
import { Arbcheck } from "./types/arbcheck";

// === CONFIGURABLE CONSTANTS ===
const RPC_URL = process.env.RPC_URL || "https://solana-rpc.publicnode.com";
const QUOTE_URL = process.env.QUOTE_URL || "https://api.jup.ag/swap/v1/quote";
const SWAP_INSTRUCTION_URL =
  process.env.SWAP_INSTRUCTION_URL ||
  "https://api.jup.ag/swap/v1/swap-instructions";
const JITO_BUNDLE_URL =
  process.env.JITO_BUNDLE_URL ||
  "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles";
const W_SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PROFIT_THRESHOLD = 3000;
const TIP_RATE = 0.5; // 50% of profit
const LOOP_INTERVAL_MS = 200;
const ARB_CHECK_PROGRAM_ID = new PublicKey(
  "7xNxrvV9454Eo9whXXkXdKEVoMsw2V9sEiQPkpNiYAxx",
); // <-- Replace with arb check program ID

const JITO_TIP_ACCOUNT = new PublicKey(
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
);

// === SETUP ===
const payer = getKeypairFromEnvironment("SECRET_KEY");
console.log("payer:", payer.publicKey.toBase58());

// Create a Wallet interface adapter for anchor
const wallet = {
  publicKey: payer.publicKey,
  signTransaction: async <T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> => {
    if (tx instanceof VersionedTransaction) {
      tx.sign([payer]);
    } else {
      // Legacy transaction
      tx.partialSign(payer);
    }
    return tx;
  },
  signAllTransactions: async <T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> => {
    return txs.map((t) => {
      if (t instanceof VersionedTransaction) {
        t.sign([payer]);
      } else {
        // Legacy transaction
        t.partialSign(payer);
      }
      return t;
    });
  },
};

const connection = new Connection(RPC_URL, "processed");
const provider = new AnchorProvider(connection, wallet);
const program = new Program(idl as Arbcheck, provider);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function instructionFormat(instruction) {
  return {
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  };
}

async function getQuotes() {
  try {
    const quote0Params = {
      inputMint: W_SOL_MINT,
      outputMint: USDC_MINT,
      amount: 10000000, // 0.01 WSOL
      onlyDirectRoutes: false,
      slippageBps: 0,
      maxAccounts: 20,
    };
    const quote0Resp = await axios.get(QUOTE_URL, { params: quote0Params });

    const quote1Params = {
      inputMint: USDC_MINT,
      outputMint: W_SOL_MINT,
      amount: quote0Resp.data.outAmount,
      onlyDirectRoutes: false,
      slippageBps: 0,
      maxAccounts: 20,
    };
    const quote1Resp = await axios.get(QUOTE_URL, { params: quote1Params });

    return { quote0Resp, quote1Resp, quote0Params };
  } catch (e) {
    console.error("Error fetching quotes:", e);
    throw e;
  }
}

async function buildAndSendTransaction({
  quote0Resp,
  quote1Resp,
  quote0Params,
}) {
  const diffLamports = quote1Resp.data.outAmount - quote0Params.amount;
  console.log("diffLamports:", diffLamports);
  const jitoTip = Math.floor(diffLamports * TIP_RATE);

  if (diffLamports <= PROFIT_THRESHOLD) {
    console.log("Profit below threshold, skipping...");
    return;
  }

  // Merge quotes for Jupiter swap
  let mergedQuoteResp = { ...quote0Resp.data };
  mergedQuoteResp.outputMint = quote1Resp.data.outputMint;
  mergedQuoteResp.outAmount = String(quote0Params.amount + jitoTip);
  mergedQuoteResp.otherAmountThreshold = String(quote0Params.amount + jitoTip);
  mergedQuoteResp.priceImpactPct = "0";
  mergedQuoteResp.routePlan = mergedQuoteResp.routePlan.concat(
    quote1Resp.data.routePlan,
  );

  // Get swap instructions from Jupiter
  let swapData = {
    userPublicKey: payer.publicKey.toBase58(),
    wrapAndUnwrapSol: false,
    useSharedAccounts: false,
    computeUnitPriceMicroLamports: 1,
    dynamicComputeUnitLimit: true,
    skipUserAccountsRpcCalls: true,
    quoteResponse: mergedQuoteResp,
  };
  let instructionsResp;
  try {
    instructionsResp = await axios.post(SWAP_INSTRUCTION_URL, swapData);
  } catch (e) {
    console.error("Error fetching swap instructions:", e);
    return;
  }
  const instructions = instructionsResp.data;

  let ixs: TransactionInstruction[] = [];

  // 1. Compute unit limit
  const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
    units: instructions.computeUnitLimit,
  });
  ixs.push(computeUnitLimitInstruction);

  // 2. Setup instructions
  const setupInstructions =
    instructions.setupInstructions.map(instructionFormat);
  ixs = ixs.concat(setupInstructions);

  // 3. Save balance instruction from your program
  const [statePda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state"), payer.publicKey.toBuffer()],
    ARB_CHECK_PROGRAM_ID,
  );
  const wsolTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(W_SOL_MINT),
    payer.publicKey,
  );
  const saveBalanceIx = await program.methods
    .saveBalance()
    .accounts({
      user: payer.publicKey,
      wsolAccount: wsolTokenAccount,
      state: statePda,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
  ixs.push(saveBalanceIx);

  // 4. Swap
  const swapInstructions = instructionFormat(instructions.swapInstruction);
  ixs.push(swapInstructions);

  // 5. Check profit via onchain program
  const checkProfitIx = await program.methods
    .checkProfit(new BN(jitoTip + PROFIT_THRESHOLD))
    .accounts({
      user: payer.publicKey,
      wsolAccount: wsolTokenAccount,
      state: statePda,
    })
    .instruction();
  ixs.push(checkProfitIx);

  // 6. Jito tip transfer Ix
  const tipInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: JITO_TIP_ACCOUNT,
    lamports: jitoTip,
  });
  ixs.push(tipInstruction);

  // 7. Address Lookup Table
  let addressLookupTableAccounts: (AddressLookupTableAccount | null)[] = [];
  try {
    addressLookupTableAccounts = await Promise.all(
      instructions.addressLookupTableAddresses.map(async (address) => {
        const result = await connection.getAddressLookupTable(
          new PublicKey(address),
        );
        return result.value;
      }),
    );
  } catch (e) {
    console.error("Error fetching ALT accounts:", e);
    return;
  }

  // 8. Build and sign transaction
  let transaction;
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message(
      addressLookupTableAccounts.filter(Boolean) as AddressLookupTableAccount[],
    );
    transaction = new VersionedTransaction(messageV0);
    transaction.sign([payer]);
  } catch (e) {
    console.error("Error building/signing transaction:", e);
    return;
  }

  // 9. Simulate transaction (Optional)
  // try {
  //     const simulationResult = await connection.simulateTransaction(transaction);
  //     console.log(JSON.stringify(simulationResult));
  // } catch (e) {
  //     console.error("Simulation error:", e);
  //     return;
  // }

  // 10. Send bundle to Jito
  try {
    const serializedTransaction = transaction.serialize();
    const base58Transaction = bs58.encode(serializedTransaction);

    const bundle = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      params: [[base58Transaction]],
    };

    const bundle_resp = await axios.post(JITO_BUNDLE_URL, bundle, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const bundle_id = bundle_resp.data.result;
    console.log(`sent to frankfurt, bundle id: ${bundle_id}`);
  } catch (e) {
    console.error("Error sending bundle:", e);
    return;
  }
}

async function run() {
  const start = Date.now();
  try {
    const { quote0Resp, quote1Resp, quote0Params } = await getQuotes();
    await buildAndSendTransaction({ quote0Resp, quote1Resp, quote0Params });
    const duration = Date.now() - start;
    console.log(`Total duration: ${duration}ms`);
  } catch (e) {
    console.error("Error in run:", e);
  }
}

async function main() {
  while (true) {
    await run();
    await wait(LOOP_INTERVAL_MS);
  }
}

main();
