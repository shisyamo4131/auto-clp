import type { ValidationIssue } from "./validation";

const DIMENSION_MIN = 1n;
const DIMENSION_MAX = 100_000n;
const CLEARANCE_MIN = 0n;
const CLEARANCE_MAX = 10_000n;
const MASS_MIN_GRAMS = 1n;
const MASS_MAX_GRAMS = 100_000_000n;
const POSITION_MIN_MM = -1_000_000n;
const POSITION_MAX_MM = 1_000_000n;
const MAX_KILOGRAM_INPUT_LENGTH = 10;
const MAX_POSITION_DIGITS = POSITION_MAX_MM.toString().length;
const MAX_POSITION_INPUT_LENGTH = POSITION_MAX_MM.toString().length + 1;

export const CARGO_CREATION_LIMIT = 30;

export type ParsedIntegerResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly issue: ValidationIssue };

function parseIntegerRange(
  raw: string,
  path: string,
  minimum: bigint,
  maximum: bigint,
): ParsedIntegerResult {
  const value = raw.trim();
  if (value.length > maximum.toString().length) {
    return { ok: false, issue: { code: "input.mm-length", path } };
  }
  if (!/^[0-9]+$/.test(value)) {
    return { ok: false, issue: { code: "input.mm-format", path } };
  }

  const parsed = BigInt(value);
  if (parsed < minimum || parsed > maximum) {
    return { ok: false, issue: { code: "input.mm-range", path } };
  }
  return { ok: true, value: Number(parsed) };
}

export function parseDimensionMm(
  raw: string,
  path = "/dimensionMm",
): ParsedIntegerResult {
  return parseIntegerRange(raw, path, DIMENSION_MIN, DIMENSION_MAX);
}

export function parseClearanceMm(
  raw: string,
  path = "/clearanceMm",
): ParsedIntegerResult {
  return parseIntegerRange(raw, path, CLEARANCE_MIN, CLEARANCE_MAX);
}

export function parsePositionMm(
  raw: string,
  path = "/positionMm",
): ParsedIntegerResult {
  if (raw.length > MAX_POSITION_INPUT_LENGTH) {
    return { ok: false, issue: { code: "input.mm-length", path } };
  }
  if (!/^-?[0-9]+$/.test(raw)) {
    return { ok: false, issue: { code: "input.mm-format", path } };
  }
  const digitLength = raw.startsWith("-") ? raw.length - 1 : raw.length;
  if (digitLength > MAX_POSITION_DIGITS) {
    return { ok: false, issue: { code: "input.mm-length", path } };
  }

  const parsed = BigInt(raw);
  if (parsed < POSITION_MIN_MM || parsed > POSITION_MAX_MM) {
    return { ok: false, issue: { code: "input.mm-range", path } };
  }
  return { ok: true, value: Number(parsed) };
}

export function parseKilogramsToGrams(
  raw: string,
  path = "/massKg",
): ParsedIntegerResult {
  const value = raw.trim();
  if (value.length > MAX_KILOGRAM_INPUT_LENGTH) {
    return { ok: false, issue: { code: "input.kg-length", path } };
  }
  const match = /^(?<whole>[0-9]+)(?:\.(?<fraction>[0-9]{1,3}))?$/.exec(value);
  if (match?.groups === undefined) {
    return { ok: false, issue: { code: "input.kg-format", path } };
  }

  const whole = match.groups.whole;
  if (whole === undefined) {
    return { ok: false, issue: { code: "input.kg-format", path } };
  }
  const fraction = (match.groups.fraction ?? "").padEnd(3, "0");
  const grams = BigInt(whole) * 1_000n + BigInt(fraction || "0");
  if (grams < MASS_MIN_GRAMS || grams > MASS_MAX_GRAMS) {
    return { ok: false, issue: { code: "input.kg-range", path } };
  }
  return { ok: true, value: Number(grams) };
}
