use anchor_lang::prelude::*;

#[error_code]
pub enum StakeError {
    #[msg("Max stake amount reached")]
    MaxStakeReached,
    #[msg("Freeze period not passed")]
    FreezePeriodNotPassed,
}
