const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("A JSON object is required.");
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ValidationError(`${name} is required and must be at most ${max} characters.`);
  return value.trim();
}

function optionalText(value: unknown, max = 2000): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > max) throw new ValidationError(`Text must be at most ${max} characters.`);
  return value.trim();
}

function number(value: unknown, name: string, min = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min) throw new ValidationError(`${name} must be a finite number of at least ${min}.`);
  return parsed;
}

function integer(value: unknown, name: string, min = 0): number {
  const parsed = number(value, name, min);
  if (!Number.isInteger(parsed)) throw new ValidationError(`${name} must be an integer.`);
  return parsed;
}

function date(value: unknown, name: string): string {
  const parsed = text(value, name, 10);
  if (!DATE_PATTERN.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) throw new ValidationError(`${name} must be a valid YYYY-MM-DD date.`);
  return parsed;
}

export function normalizeEmail(value: unknown): string {
  const email = text(value, "Email", 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new ValidationError("A valid email address is required.");
  return email;
}

export function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) throw new ValidationError("Password must be between 10 and 128 characters.");
  return value;
}

export function parseIncome(value: unknown) {
  const input = record(value);
  const startDate = date(input.startDate, "Start date");
  const endDate = date(input.endDate, "End date");
  if (endDate < startDate) throw new ValidationError("End date cannot be before start date.");
  const onlineMinutes = integer(input.onlineMinutes, "Online minutes");
  const activeMinutes = integer(input.activeMinutes, "Active minutes");
  if (activeMinutes > onlineMinutes) throw new ValidationError("Active minutes cannot exceed online minutes.");
  const netFare = number(input.netFare, "Net fare");
  const tips = number(input.tips, "Tips");
  const taxes = number(input.taxes, "Taxes");
  return { startDate, endDate, trips: integer(input.trips, "Trips"), onlineMinutes, activeMinutes, netFare, tips, taxes, totalEarnings: Math.round((netFare + tips - taxes) * 100) / 100, notes: optionalText(input.notes) };
}

export function parseMileage(value: unknown) {
  const input = record(value);
  const startOdometer = number(input.startOdometer, "Start odometer");
  const endOdometer = number(input.endOdometer, "End odometer");
  if (endOdometer <= startOdometer) throw new ValidationError("End odometer must be greater than start odometer.");
  return { date: date(input.date, "Date"), purpose: text(input.purpose, "Purpose", 500), startOdometer, endOdometer, distance: Math.round((endOdometer - startOdometer) * 100) / 100, tripType: text(input.tripType, "Trip type", 100), notes: optionalText(input.notes) };
}

export function parseExpense(value: unknown) {
  const input = record(value);
  const amount = number(input.amount, "Amount", 0.01);
  const gstHstEligible = input.gstHstEligible === true;
  const gstHstAmount = gstHstEligible ? number(input.gstHstAmount ?? 0, "GST/HST amount") : 0;
  if (gstHstAmount > amount) throw new ValidationError("GST/HST amount cannot exceed the expense amount.");
  return { date: date(input.date, "Date"), category: text(input.category, "Category", 100), amount, description: text(input.description, "Description", 1000), gstHstEligible, gstHstAmount };
}
