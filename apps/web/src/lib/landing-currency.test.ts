import { describe, expect, it } from "vitest";

import {
  convertCurrency,
  formatCurrencyAmount,
  getCurrency,
} from "./landing-currency";

describe("landing currency examples", () => {
  it("keeps every illustrative figure on one ratio", () => {
    expect(getCurrency("INR").rateToEur).toBe(90);
    expect(convertCurrency(1, "EUR", "INR")).toBe(90);
    expect(convertCurrency(90, "INR", "EUR")).toBe(1);
  });

  it("leaves amounts in the same currency untouched", () => {
    expect(convertCurrency(38.2, "EUR", "EUR")).toBe(38.2);
  });

  it("guards invalid amounts instead of rendering NaN", () => {
    expect(convertCurrency(Number.NaN, "EUR", "INR")).toBe(0);
    expect(convertCurrency(Number.POSITIVE_INFINITY, "EUR", "INR")).toBe(0);
    expect(formatCurrencyAmount(Number.NaN, "INR")).toBe("₹0.00");
  });

  it("formats ordinary and high-denomination currencies", () => {
    expect(formatCurrencyAmount(1665, "INR")).toBe("₹1,665.00");
    expect(formatCurrencyAmount(1234.6, "JPY")).toBe("¥1,235");
  });
});
