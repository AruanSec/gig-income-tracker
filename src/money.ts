import Decimal from "decimal.js";

// Keep enough significant digits for totals, distances, rates and percentages.
export const FinancialDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const MAX_MONEY = 9_999_999_999.99;
export function roundMoney(value: Decimal.Value): number {
  const result = new FinancialDecimal(value).toDecimalPlaces(2);
  if (!result.isFinite()) throw new Error("Money must be finite.");
  return result.toNumber();
}
export function addMoney(...values: number[]): number {
  return roundMoney(values.reduce((sum, value) => sum.plus(value), new FinancialDecimal(0)));
}
export function subtractMoney(left: number, right: number): number {
  return roundMoney(new FinancialDecimal(left).minus(right));
}
export function percentMoney(value: number, percentage: number): number {
  return roundMoney(new FinancialDecimal(value).times(percentage).div(100));
}
export function sumMoney<T>(values: T[], amount: (value: T) => number): number {
  return roundMoney(values.reduce((sum, value) => sum.plus(amount(value)), new FinancialDecimal(0)));
}
