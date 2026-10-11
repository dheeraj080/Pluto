/**
 * Maintained ISO 4217 currency registry.
 *
 * This is the authoritative list for *recording*: an expense may be filed in
 * any active ISO 4217 code, regardless of whether the configured exchange-rate
 * provider can convert it. Recording validity and conversion availability are
 * deliberately separate concerns — see `CurrencyService`.
 *
 * Symbols are the conventional display symbol where one is widely agreed; when
 * that is ambiguous or awkward we fall back to the code so totals never render
 * a misleading glyph. `decimals` follows the ISO minor-unit convention (0 for
 * JPY/KRW/VND, 3 for BHD/KWD/OMR...).
 */

export interface CurrencyMeta {
  /** Human-readable English name. */
  name: string;
  /** Display symbol or the code itself when no safe symbol exists. */
  symbol: string;
  /** Number of minor units (ISO 4217 exponent). */
  decimals: number;
}

export const CURRENCY_REGISTRY: Record<string, CurrencyMeta> = {
  AED: { name: 'UAE Dirham', symbol: 'AED', decimals: 2 },
  AFN: { name: 'Afghan Afghani', symbol: 'Af', decimals: 2 },
  ALL: { name: 'Albanian Lek', symbol: 'Lek', decimals: 2 },
  AMD: { name: 'Armenian Dram', symbol: '֏', decimals: 2 },
  ANG: { name: 'Netherlands Antillean Guilder', symbol: 'ƒ', decimals: 2 },
  AOA: { name: 'Angolan Kwanza', symbol: 'Kz', decimals: 2 },
  ARS: { name: 'Argentine Peso', symbol: 'AR$', decimals: 2 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  AWG: { name: 'Aruban Florin', symbol: 'Afl.', decimals: 2 },
  AZN: { name: 'Azerbaijani Manat', symbol: '₼', decimals: 2 },
  BAM: { name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', decimals: 2 },
  BBD: { name: 'Barbadian Dollar', symbol: 'Bds$', decimals: 2 },
  BDT: { name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
  BGN: { name: 'Bulgarian Lev', symbol: 'лв', decimals: 2 },
  BHD: { name: 'Bahraini Dinar', symbol: 'BD', decimals: 3 },
  BIF: { name: 'Burundian Franc', symbol: 'FBu', decimals: 0 },
  BMD: { name: 'Bermudian Dollar', symbol: 'BD$', decimals: 2 },
  BND: { name: 'Brunei Dollar', symbol: 'B$', decimals: 2 },
  BOB: { name: 'Bolivian Boliviano', symbol: 'Bs', decimals: 2 },
  BRL: { name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  BSD: { name: 'Bahamian Dollar', symbol: 'B$', decimals: 2 },
  BTN: { name: 'Bhutanese Ngultrum', symbol: 'Nu.', decimals: 2 },
  BWP: { name: 'Botswana Pula', symbol: 'P', decimals: 2 },
  BYN: { name: 'Belarusian Ruble', symbol: 'Br', decimals: 2 },
  BZD: { name: 'Belize Dollar', symbol: 'BZ$', decimals: 2 },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  CDF: { name: 'Congolese Franc', symbol: 'FC', decimals: 2 },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  CLP: { name: 'Chilean Peso', symbol: 'CLP$', decimals: 0 },
  CNY: { name: 'Chinese Yuan', symbol: 'CN¥', decimals: 2 },
  COP: { name: 'Colombian Peso', symbol: 'COL$', decimals: 2 },
  CRC: { name: 'Costa Rican Colón', symbol: '₡', decimals: 2 },
  CUP: { name: 'Cuban Peso', symbol: '₱', decimals: 2 },
  CVE: { name: 'Cape Verdean Escudo', symbol: 'Esc', decimals: 2 },
  CZK: { name: 'Czech Koruna', symbol: 'Kč', decimals: 2 },
  DJF: { name: 'Djiboutian Franc', symbol: 'Fdj', decimals: 0 },
  DKK: { name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  DOP: { name: 'Dominican Peso', symbol: 'RD$', decimals: 2 },
  DZD: { name: 'Algerian Dinar', symbol: 'DA', decimals: 2 },
  EGP: { name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
  ERN: { name: 'Eritrean Nakfa', symbol: 'Nfk', decimals: 2 },
  ETB: { name: 'Ethiopian Birr', symbol: 'Br', decimals: 2 },
  EUR: { name: 'Euro', symbol: '€', decimals: 2 },
  FJD: { name: 'Fijian Dollar', symbol: 'FJ$', decimals: 2 },
  FKP: { name: 'Falkland Islands Pound', symbol: 'FK£', decimals: 2 },
  GBP: { name: 'British Pound Sterling', symbol: '£', decimals: 2 },
  GEL: { name: 'Georgian Lari', symbol: '₾', decimals: 2 },
  GHS: { name: 'Ghanaian Cedi', symbol: '₵', decimals: 2 },
  GIP: { name: 'Gibraltar Pound', symbol: 'G£', decimals: 2 },
  GMD: { name: 'Gambian Dalasi', symbol: 'D', decimals: 2 },
  GNF: { name: 'Guinean Franc', symbol: 'FG', decimals: 0 },
  GTQ: { name: 'Guatemalan Quetzal', symbol: 'Q', decimals: 2 },
  GYD: { name: 'Guyanese Dollar', symbol: 'G$', decimals: 2 },
  HKD: { name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  HNL: { name: 'Honduran Lempira', symbol: 'L', decimals: 2 },
  HTG: { name: 'Haitian Gourde', symbol: 'G', decimals: 2 },
  HUF: { name: 'Hungarian Forint', symbol: 'Ft', decimals: 2 },
  IDR: { name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 2 },
  ILS: { name: 'Israeli New Shekel', symbol: '₪', decimals: 2 },
  INR: { name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  IQD: { name: 'Iraqi Dinar', symbol: 'IQD', decimals: 3 },
  IRR: { name: 'Iranian Rial', symbol: 'IRR', decimals: 2 },
  ISK: { name: 'Icelandic Króna', symbol: 'ISK', decimals: 0 },
  JMD: { name: 'Jamaican Dollar', symbol: 'J$', decimals: 2 },
  JOD: { name: 'Jordanian Dinar', symbol: 'JD', decimals: 3 },
  JPY: { name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2 },
  KGS: { name: 'Kyrgyzstani Som', symbol: 'som', decimals: 2 },
  KHR: { name: 'Cambodian Riel', symbol: '៛', decimals: 2 },
  KMF: { name: 'Comorian Franc', symbol: 'CF', decimals: 0 },
  KPW: { name: 'North Korean Won', symbol: '₩', decimals: 2 },
  KRW: { name: 'South Korean Won', symbol: '₩', decimals: 0 },
  KWD: { name: 'Kuwaiti Dinar', symbol: 'KD', decimals: 3 },
  KYD: { name: 'Cayman Islands Dollar', symbol: 'CI$', decimals: 2 },
  KZT: { name: 'Kazakhstani Tenge', symbol: '₸', decimals: 2 },
  LAK: { name: 'Lao Kip', symbol: '₭', decimals: 2 },
  LBP: { name: 'Lebanese Pound', symbol: 'L£', decimals: 2 },
  LKR: { name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2 },
  LRD: { name: 'Liberian Dollar', symbol: 'L$', decimals: 2 },
  LSL: { name: 'Lesotho Loti', symbol: 'L', decimals: 2 },
  LYD: { name: 'Libyan Dinar', symbol: 'LD', decimals: 3 },
  MAD: { name: 'Moroccan Dirham', symbol: 'DH', decimals: 2 },
  MDL: { name: 'Moldovan Leu', symbol: 'L', decimals: 2 },
  MGA: { name: 'Malagasy Ariary', symbol: 'Ar', decimals: 2 },
  MKD: { name: 'Macedonian Denar', symbol: 'ден', decimals: 2 },
  MMK: { name: 'Myanmar Kyat', symbol: 'K', decimals: 2 },
  MNT: { name: 'Mongolian Tögrög', symbol: '₮', decimals: 2 },
  MOP: { name: 'Macanese Pataca', symbol: 'MOP$', decimals: 2 },
  MRU: { name: 'Mauritanian Ouguiya', symbol: 'UM', decimals: 2 },
  MUR: { name: 'Mauritian Rupee', symbol: 'Rs', decimals: 2 },
  MVR: { name: 'Maldivian Rufiyaa', symbol: 'Rf', decimals: 2 },
  MWK: { name: 'Malawian Kwacha', symbol: 'MK', decimals: 2 },
  MXN: { name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  MZN: { name: 'Mozambican Metical', symbol: 'MT', decimals: 2 },
  NAD: { name: 'Namibian Dollar', symbol: 'N$', decimals: 2 },
  NGN: { name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  NIO: { name: 'Nicaraguan Córdoba', symbol: 'C$', decimals: 2 },
  NOK: { name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  NPR: { name: 'Nepalese Rupee', symbol: 'Rs', decimals: 2 },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  OMR: { name: 'Omani Rial', symbol: 'OMR', decimals: 3 },
  PAB: { name: 'Panamanian Balboa', symbol: 'B/.', decimals: 2 },
  PEN: { name: 'Peruvian Sol', symbol: 'S/', decimals: 2 },
  PGK: { name: 'Papua New Guinean Kina', symbol: 'K', decimals: 2 },
  PHP: { name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  PKR: { name: 'Pakistani Rupee', symbol: 'Rs', decimals: 2 },
  PLN: { name: 'Polish Złoty', symbol: 'zł', decimals: 2 },
  PYG: { name: 'Paraguayan Guaraní', symbol: '₲', decimals: 0 },
  QAR: { name: 'Qatari Riyal', symbol: 'QR', decimals: 2 },
  RON: { name: 'Romanian Leu', symbol: 'lei', decimals: 2 },
  RSD: { name: 'Serbian Dinar', symbol: 'din', decimals: 2 },
  RUB: { name: 'Russian Ruble', symbol: '₽', decimals: 2 },
  RWF: { name: 'Rwandan Franc', symbol: 'FRw', decimals: 0 },
  SAR: { name: 'Saudi Riyal', symbol: 'SR', decimals: 2 },
  SBD: { name: 'Solomon Islands Dollar', symbol: 'SI$', decimals: 2 },
  SCR: { name: 'Seychellois Rupee', symbol: 'SR', decimals: 2 },
  SDG: { name: 'Sudanese Pound', symbol: 'SDG', decimals: 2 },
  SEK: { name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  SHP: { name: 'Saint Helena Pound', symbol: '£', decimals: 2 },
  SLE: { name: 'Sierra Leonean Leone', symbol: 'Le', decimals: 2 },
  SOS: { name: 'Somali Shilling', symbol: 'Sh', decimals: 2 },
  SRD: { name: 'Surinamese Dollar', symbol: 'SR$', decimals: 2 },
  SSP: { name: 'South Sudanese Pound', symbol: 'SS£', decimals: 2 },
  STN: { name: 'São Tomé and Príncipe Dobra', symbol: 'Db', decimals: 2 },
  SYP: { name: 'Syrian Pound', symbol: 'SY£', decimals: 2 },
  SZL: { name: 'Swazi Lilangeni', symbol: 'L', decimals: 2 },
  THB: { name: 'Thai Baht', symbol: '฿', decimals: 2 },
  TJS: { name: 'Tajikistani Somoni', symbol: 'SM', decimals: 2 },
  TMT: { name: 'Turkmenistani Manat', symbol: 'T', decimals: 2 },
  TND: { name: 'Tunisian Dinar', symbol: 'DT', decimals: 3 },
  TOP: { name: 'Tongan Paʻanga', symbol: 'T$', decimals: 2 },
  TRY: { name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  TTD: { name: 'Trinidad and Tobago Dollar', symbol: 'TT$', decimals: 2 },
  TWD: { name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 2 },
  TZS: { name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 2 },
  UAH: { name: 'Ukrainian Hryvnia', symbol: '₴', decimals: 2 },
  UGX: { name: 'Ugandan Shilling', symbol: 'USh', decimals: 0 },
  USD: { name: 'United States Dollar', symbol: '$', decimals: 2 },
  UYU: { name: 'Uruguayan Peso', symbol: '$U', decimals: 2 },
  UZS: { name: 'Uzbekistani Som', symbol: 'soʻm', decimals: 2 },
  VES: { name: 'Venezuelan Bolívar', symbol: 'Bs.', decimals: 2 },
  VND: { name: 'Vietnamese Đồng', symbol: '₫', decimals: 0 },
  VUV: { name: 'Vanuatu Vatu', symbol: 'VT', decimals: 0 },
  WST: { name: 'Samoan Tala', symbol: 'WS$', decimals: 2 },
  XAF: { name: 'Central African CFA Franc', symbol: 'FCFA', decimals: 0 },
  XCD: { name: 'East Caribbean Dollar', symbol: 'EC$', decimals: 2 },
  XOF: { name: 'West African CFA Franc', symbol: 'CFA', decimals: 0 },
  XPF: { name: 'CFP Franc', symbol: '₣', decimals: 0 },
  YER: { name: 'Yemeni Rial', symbol: 'YR', decimals: 2 },
  ZAR: { name: 'South African Rand', symbol: 'R', decimals: 2 },
  ZMW: { name: 'Zambian Kwacha', symbol: 'ZK', decimals: 2 },
  ZWL: { name: 'Zimbabwean Dollar', symbol: 'Z$', decimals: 2 },
};

/** True for a syntactically plausible three-letter code (not yet registry-validated). */
export function isIsoCodeShape(value: string): boolean {
  return /^[A-Za-z]{3}$/.test(value.trim());
}

/**
 * Normalises a user-supplied currency code: trims, uppercases and returns the
 * value only when it has the ISO 4217 three-letter shape, else null.
 */
export function normalizeCurrencyCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return isIsoCodeShape(code) ? code : null;
}

/** True when the (normalised) code exists in the registry. */
export function isKnownCurrencyCode(code: string): boolean {
  return CURRENCY_REGISTRY[code] !== undefined;
}

/** Metadata for a known code; falls back to the code itself when unknown. */
export function getCurrencyMeta(code: string): CurrencyMeta {
  return (
    CURRENCY_REGISTRY[code] ?? {
      name: code,
      symbol: code,
      decimals: 2,
    }
  );
}
