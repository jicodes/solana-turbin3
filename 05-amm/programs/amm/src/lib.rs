pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3kANf1LyNTbW6z5hZgFjqVNifw1mS49As7Y93bD7QqZv");

#[program]
pub mod amm {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        seed: u64,
        fee: u16,
        authority: Option<Pubkey>,
    ) -> Result<()> {
        ctx.accounts.initialize(seed, fee, authority, &ctx.bumps)
    }

    pub fn deposit(ctx: Context<Deposit>, lp_amount: u64, max_x: u64, max_y: u64) -> Result<()> {
        ctx.accounts.deposit(lp_amount, max_x, max_y)
    }
}
