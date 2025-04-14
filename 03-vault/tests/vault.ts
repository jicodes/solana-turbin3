import * as anchor from "@coral-xyz/anchor";
import { Program, Wallet } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import {
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

describe("vault", () => {
  // Setup provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Vault as Program<Vault>;
  const signer = provider.wallet as Wallet;

  // Precompute PDAs
  const [vaultStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), signer.publicKey.toBuffer()],
    program.programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), vaultStatePda.toBuffer()],
    program.programId
  );

  // Common accounts object for reuse
  const baseAccounts = {
    signer: signer.publicKey,
    vault_state: vaultStatePda,
    vault: vaultPda,
    system_program: SystemProgram.programId,
  };

  it("Initializes the vault state", async () => {
    const tx = await program.methods
      .initialize()
      .accounts(baseAccounts)
      .rpc();
    console.log("Initialize tx signature:", tx);

    // Fetch and verify vault_state
    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    expect(vaultState.stateBump).to.be.a("number", "State bump should be set");

    // Verify vault PDA exists (though not initialized with data)
    const vaultInfo = await provider.connection.getAccountInfo(vaultPda);
    expect(vaultInfo).to.not.be.null;
  });

  it("Deposits lamports into the vault", async () => {
    const depositAmount = 1 * LAMPORTS_PER_SOL; // 1 SOL
    const signerBalanceBefore = await provider.connection.getBalance(signer.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

    const tx = await program.methods
      .deposit(new anchor.BN(depositAmount))
      .accounts(baseAccounts)
      .rpc();
    console.log("Deposit tx signature:", tx);

    // Verify balances
    const signerBalanceAfter = await provider.connection.getBalance(signer.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

    // Account for rent and fees
    expect(signerBalanceBefore - signerBalanceAfter).to.be.at.least(
      depositAmount,
      "Signer balance should decrease by at least deposit amount"
    );
    expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(
      depositAmount,
      "Vault balance should increase by deposit amount"
    );
  });

  it("Withdraws lamports from the vault", async () => {
    const withdrawAmount = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL
    const signerBalanceBefore = await provider.connection.getBalance(signer.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

    const tx = await program.methods
      .withdraw(new anchor.BN(withdrawAmount))
      .accounts(baseAccounts)
      .rpc();
    console.log("Withdraw tx signature:", tx);

    // Verify balances
    const signerBalanceAfter = await provider.connection.getBalance(signer.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

    expect(vaultBalanceBefore - vaultBalanceAfter).to.equal(
      withdrawAmount,
      "Vault balance should decrease by withdraw amount"
    );
    // Allow for transaction fee (~5000 lamports)
    expect(signerBalanceAfter - signerBalanceBefore).to.be.at.least(
      withdrawAmount - 5000, // Approx fee tolerance
      "Signer balance should increase by withdraw amount (minus fees)"
    );
  });

  it("Closes the vault state and vault", async () => {
    const signerBalanceBefore = await provider.connection.getBalance(signer.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);
    const vaultStateBalanceBefore = await provider.connection.getBalance(vaultStatePda);

    const tx = await program.methods
      .close()
      .accounts(baseAccounts)
      .rpc();
    console.log("Close tx signature:", tx);

    // Verify vault_state is closed
    const vaultStateInfo = await provider.connection.getAccountInfo(vaultStatePda);
    expect(vaultStateInfo).to.be.null;

    // Verify vault lamports transferred to signer
    const signerBalanceAfter = await provider.connection.getBalance(signer.publicKey);
    const vaultInfoAfterClose = await provider.connection.getAccountInfo(vaultPda);

    // The vault account itself isn't closed, only the vault_state account is.
    // Lamports should be transferred though.
    expect(vaultInfoAfterClose?.lamports).to.equal(
      0,
      "Vault lamports should be 0 after transfer"
    );

    // Signer should receive lamports from vault_state closure and vault transfer, minus fee
    const expectedGain = vaultBalanceBefore + vaultStateBalanceBefore - 5000; // Approx fee
    expect(signerBalanceAfter - signerBalanceBefore).to.be.at.least(
        expectedGain,
        "Signer should receive vault and vault_state lamports (minus fees)"
    );

    // Log final state
    console.log("Vault info after close:", vaultInfoAfterClose);
  });
});
