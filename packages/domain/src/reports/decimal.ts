/**
 * Exact decimal arithmetic for report conversion, with no dependency.
 *
 * The server converts a row with `Decimal(amount).div(fromRate).mul(toRate)`
 * and rounds the result half-up to two places. Doing the same with JS doubles
 * would diverge at half-cent boundaries (`(1.005).toFixed(2) === '1.00'`, while
 * a true half-up gives `1.01`), so the on-device engine reproduces the *exact*
 * rational value and rounds it with integer arithmetic instead.
 *
 * The only difference from decimal.js is that decimal.js also rounds each
 * intermediate to 20 significant digits; that rounding is far below a half-cent
 * and cannot change a two-decimal result outside contrived inputs.
 */

interface ParsedDecimal {
  /** `-1` or `1`. */
  sign: number;
  /** Unsigned unscaled value. */
  value: bigint;
  /** The number is `sign * value / 10^scale`. */
  scale: number;
}

const DECIMAL_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

function parseDecimal(input: number | string): ParsedDecimal {
  const text = typeof input === 'number' ? String(input) : input.trim();
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) throw new Error(`'${String(input)}' is not a decimal number`);

  const [, signText, intText, fracText = '', expText] = match;
  if (intText === '' && fracText === '') throw new Error(`'${String(input)}' is not a decimal number`);

  let value = BigInt((intText || '0') + fracText);
  let scale = fracText.length;

  if (expText) {
    const exponent = Number(expText);
    if (!Number.isFinite(exponent)) throw new Error(`'${String(input)}' is not a decimal number`);
    scale -= exponent;
  }

  if (scale < 0) {
    value *= 10n ** BigInt(-scale);
    scale = 0;
  }

  return { sign: signText === '-' && value !== 0n ? -1 : 1, value, scale };
}

/**
 * Computes `amount / from * to`, rounded half-away-from-zero to two decimals,
 * exactly. Returns a JS number — the same value `Number(decimal.toFixed(2))`
 * yields on the server.
 */
export function divideMultiplyRound2(
  amount: number | string,
  from: number | string,
  to: number | string,
): number {
  const a = parseDecimal(amount);
  const f = parseDecimal(from);
  const t = parseDecimal(to);
  if (f.value === 0n) throw new Error('division by zero');

  const sign = a.sign * t.sign * f.sign < 0 ? -1 : 1;

  // |amount / from * to| * 100 = value * 100 / (from * 10^scale).
  const scale = a.scale + t.scale - f.scale;
  let numerator = a.value * t.value * 100n;
  let denominator = f.value;
  if (scale >= 0) denominator *= 10n ** BigInt(scale);
  else numerator *= 10n ** BigInt(-scale);

  // Round half away from zero: floor((2n + d) / 2d).
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  const cents = sign < 0 ? -rounded : rounded;
  return Number(cents) / 100;
}

/** Rounds a decimal to two places, half-away-from-zero, exactly. */
export function roundHalfUp2(amount: number | string): number {
  return divideMultiplyRound2(amount, 1, 1);
}
