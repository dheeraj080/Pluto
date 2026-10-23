export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  rateToEur: number;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", rateToEur: 1.085 },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", rateToEur: 1.0 },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", rateToEur: 0.855 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳", rateToEur: 90.0 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵", rateToEur: 165.2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", flag: "🇨🇦", rateToEur: 1.48 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺", rateToEur: 1.66 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷", rateToEur: 1465.0 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭", rateToEur: 0.965 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷", rateToEur: 5.62 },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", flag: "🇲🇽", rateToEur: 18.9 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬", rateToEur: 1.455 },
];

export function getCurrency(code: string): Currency {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code) || {
      code,
      name: code,
      symbol: code,
      flag: "🌐",
      rateToEur: 1.0,
    }
  );
}

export function convertCurrency(amount: number, fromCode: string, toCode: string): number {
  if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount)) return 0;
  if (fromCode === toCode) return amount;
  const from = getCurrency(fromCode);
  const to = getCurrency(toCode);
  if (!from.rateToEur || from.rateToEur <= 0) return 0;
  if (!to.rateToEur || to.rateToEur <= 0) return 0;
  const amountInEur = amount / from.rateToEur;
  const result = amountInEur * to.rateToEur;
  return isFinite(result) ? result : 0;
}

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string
): string {
  const safeAmount = typeof amount === "number" && !isNaN(amount) && isFinite(amount) ? amount : 0;
  const currency = getCurrency(currencyCode);
  const isHighDenomination = currencyCode === "JPY" || currencyCode === "KRW";

  let formattedNum: string;
  if (isHighDenomination) {
    formattedNum = Math.round(safeAmount).toLocaleString("en-US");
  } else {
    formattedNum = safeAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return `${currency.symbol}${formattedNum}`;
}
