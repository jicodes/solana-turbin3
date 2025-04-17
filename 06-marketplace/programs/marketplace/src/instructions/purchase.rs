use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{close_account, transfer_checked, CloseAccount, TransferChecked},
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::{Listing, Marketplace};

#[derive(Accounts)]
pub struct Purchase<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub maker: SystemAccount<'info>,
    #[account(
      seeds = [b"marketplace", marketplace.name.as_bytes()],
      bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
    pub maker_mint: InterfaceAccount<'info, Mint>,
    #[account(
      init_if_needed,
      payer = taker,
      associated_token::mint = maker_mint,
      associated_token::authority = taker,
    )]
    pub taker_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
      init_if_needed,
      payer = taker,
      associated_token::mint = reward_mint,
      associated_token::authority = taker,
    )]
    pub taker_rewards_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
      mut,
      seeds = [b"rewards", marketplace.key().as_ref()],
      bump = marketplace.rewards_bump,
    )]
    pub reward_mint: InterfaceAccount<'info, Mint>,

    #[account(
      mut,
      associated_token::mint = maker_mint,
      associated_token::authority = listing,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
      mut,
      close = maker,
      seeds = [b"listing", marketplace.key().as_ref(), maker_mint.key().as_ref()],
      bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
      seeds = [b"treasury", marketplace.key().as_ref()],
      bump,
    )]
    pub treasury: SystemAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>, // for creating associated token accounts
    pub system_program: Program<'info, System>,                    // for creating accounts
    pub token_program: Interface<'info, TokenInterface>,           // for token operations
}

impl Purchase<'_> {
    pub fn send_sol(&mut self) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.taker.to_account_info(),
            to: self.treasury.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        let marketplace_fee = (self.marketplace.fee as u64)
            .checked_mul(self.listing.price)
            .unwrap()
            .checked_div(10000_u64)
            .unwrap();

        let amount = self.listing.price.checked_sub(marketplace_fee).unwrap();

        transfer(cpi_ctx, amount)?;

        let fee_accounts = Transfer {
            from: self.taker.to_account_info(),
            to: self.treasury.to_account_info(),
        };

        let fee_ctx = CpiContext::new(self.system_program.to_account_info(), fee_accounts);

        transfer(fee_ctx, marketplace_fee)
    }

    pub fn send_nft(&mut self) -> Result<()> {
        let seeds: &[&[u8]; 3] = &[
            &self.marketplace.key().to_bytes()[..],
            &self.maker_mint.key().to_bytes()[..],
            &[self.listing.bump],
        ];

        let signer_seeds: &[&[&[u8]]; 1] = &[&seeds[..]];
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.maker_mint.to_account_info(),
            to: self.taker_ata.to_account_info(),
            authority: self.listing.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_seeds);
        transfer_checked(cpi_ctx, 1, self.maker_mint.decimals)
    }
    pub fn close_mint_vault(&mut self) -> Result<()> {
        let seeds: &[&[u8]; 3] = &[
            &self.marketplace.key().to_bytes(),
            &self.maker_mint.key().to_bytes(),
            &[self.listing.bump],
        ];

        let signer_seeds: &[&[&[u8]]; 1] = &[&seeds[..]];

        let cpi_program = self.token_program.to_account_info();
        let close_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.maker.to_account_info(),
            authority: self.listing.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, close_accounts).with_signer(signer_seeds);

        close_account(cpi_ctx)
    }
}
