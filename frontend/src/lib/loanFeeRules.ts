/** Fee formulas from update-nov-19-2026 (loan products). */

export type ProcessingFeeSchedule = 'Base70Plus15' | 'Base100Plus10'

export const DEFAULT_INTEREST_RATE_PERCENT = 12

export function roundToTens(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value / 10) * 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 5000 = base, then +per1k on every additional 1k. */
function steppedFrom5k(principal: number, baseAt5k: number, per1k: number): number {
  if (principal <= 0) return 0
  const steps = Math.floor((principal - 5000) / 1000)
  return Math.max(0, baseAt5k + steps * per1k)
}

export function insuranceForPrincipal(principal: number): number {
  if (principal < 5000) return 0
  if (principal <= 10000) return 200
  if (principal <= 15000) return 250
  if (principal <= 20000) return 300
  return 300
}

export function processingFeeFor(
  principal: number,
  schedule: ProcessingFeeSchedule = 'Base70Plus15',
): number {
  return schedule === 'Base100Plus10'
    ? steppedFrom5k(principal, 100, 10)
    : steppedFrom5k(principal, 70, 15)
}

export function notarialFeeFor(principal: number): number {
  return steppedFrom5k(principal, 100, 5)
}

export type LoanFeeRuleResult = {
  amount: number
  interestRatePercent: number
  insuranceAmount: number
  initialSavings: number
  savingsPerPeriod: number
  insurancePerPeriod: number
  membershipFee: number
  processingFee: number
  loanRedemptionFee: number
  taxes: number
  notarialFee: number
  raffle: number
}

/** Compute product/loan charges from principal + terms. Principal is rounded to tens. */
export function computeLoanFees(
  principalInput: number,
  termCount: number,
  schedule: ProcessingFeeSchedule = 'Base70Plus15',
): LoanFeeRuleResult {
  const principal = roundToTens(principalInput)
  const terms = Math.max(0, Math.floor(termCount))
  return {
    amount: principal,
    interestRatePercent: DEFAULT_INTEREST_RATE_PERCENT,
    insuranceAmount: insuranceForPrincipal(principal),
    initialSavings: round2(principal * 0.02),
    savingsPerPeriod: terms > 0 ? round2((principal * 0.1) / terms) : 0,
    insurancePerPeriod: 0,
    membershipFee: 0,
    processingFee: processingFeeFor(principal, schedule),
    loanRedemptionFee: 0,
    taxes: round2(principal * 0.01),
    notarialFee: notarialFeeFor(principal),
    raffle: 0,
  }
}

export function feeRuleStrings(result: LoanFeeRuleResult) {
  return {
    amount: String(result.amount || ''),
    interestRatePercent: String(result.interestRatePercent),
    insuranceAmount: String(result.insuranceAmount),
    initialSavings: String(result.initialSavings),
    savingsPerPeriod: String(result.savingsPerPeriod),
    insurancePerPeriod: String(result.insurancePerPeriod),
    membershipFee: String(result.membershipFee),
    processingFee: String(result.processingFee),
    loanRedemptionFee: String(result.loanRedemptionFee),
    taxes: String(result.taxes),
    notarialFee: String(result.notarialFee),
    raffle: String(result.raffle),
  }
}

export function scheduleFromProduct(value?: string | null): ProcessingFeeSchedule {
  return value === 'Base100Plus10' ? 'Base100Plus10' : 'Base70Plus15'
}

/** Charge + interest strings for loan forms when principal/terms change. */
export function feeFieldsFromPrincipal(
  amount: number,
  termCount: number,
  schedule?: string | null,
) {
  return feeRuleStrings(computeLoanFees(amount, termCount, scheduleFromProduct(schedule)))
}
