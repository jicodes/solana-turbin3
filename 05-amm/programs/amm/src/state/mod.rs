use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub seed: u64,
    pub authority: Option<Pubkey>,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub fee: u16,
    pub locked: bool,
    pub config_bump: u8,
    pub lp_bump: u8,
}

impl Space for Config {
    const INIT_SPACE: usize = 8  // discriminator
        + 8 // seed
        + 1 + 32 // authority
        + 32 // mint_a
        + 32 // mint_b
        + 2 // fee
        + 1 // locked
        + 1 // config_bump
        + 1; // lp_bump
}
