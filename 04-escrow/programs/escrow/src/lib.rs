use anchor_lang::prelude::*;

pub mod state;
pub use state::*;

pub mod instructions;
use instructions::*;

declare_id!("77tyVbm78iJk3ktLYiWyCM6JBjevChhGeSxSGwceDA3Z");

#[program]
pub mod escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
        ctx.accounts.deposit(deposit)?;
        ctx.accounts.save_escrow(seed, &ctx.bumps, receive)
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        ctx.accounts.deposit()?;
        ctx.accounts.withdraw_and_close_vault()
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.refund_and_close_vault()
    }
}

#[derive(Accounts)]
pub struct Initialize {}
