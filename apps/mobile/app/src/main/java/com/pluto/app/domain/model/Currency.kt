package com.pluto.app.domain.model

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/**
 * Canonical Currency model identified strictly by ISO 4217 code.
 *
 * @property code Canonical 3-letter ISO 4217 currency code (e.g., "USD", "EUR", "JPY", "INR", "KWD").
 * @property name Human-readable display name (e.g., "US Dollar", "Japanese Yen", "Kuwaiti Dinar").
 * @property symbol Currency symbol (e.g., "$", "€", "¥", "₹", "KD").
 * @property decimalPlaces Standard decimal places for display and calculation (e.g., 0 for JPY, 2 for USD, 3 for KWD).
 * @property flagEmoji Region/flag emoji or indicator for quick visual recognition.
 */
data class Currency(
  val code: String,
  val name: String,
  val symbol: String,
  val decimalPlaces: Int = 2,
  val flagEmoji: String = ""
) {
  init {
    require(code.isNotBlank() && code.length == 3) {
      "Currency code must be a 3-letter ISO 4217 code, got '$code'"
    }
    require(decimalPlaces >= 0) {
      "Decimal places cannot be negative, got $decimalPlaces"
    }
  }

  /**
   * Currency-appropriate zero placeholder string (e.g., "0" for JPY/KRW, "0.00" for USD, "0.000" for KWD).
   */
  fun zeroPlaceholder(): String =
    if (decimalPlaces == 0) "0" else "0.${"0".repeat(decimalPlaces)}"

  /**
   * Sanitizes raw user text input according to this currency's [decimalPlaces].
   * Returns `null` when the proposed input violates scale rules (e.g., a decimal point for 0-decimal
   * currencies, multiple decimal points, or more than [decimalPlaces] fractional digits).
   */
  fun sanitizeAmountInput(rawInput: String): String? {
    val clean = rawInput.filter { it.isDigit() || it == '.' }
    if (clean.count { it == '.' } > 1) return null
    val dotIndex = clean.indexOf('.')
    if (decimalPlaces == 0 && dotIndex >= 0) return null
    if (dotIndex >= 0 && clean.length - dotIndex - 1 > decimalPlaces) return null
    return clean
  }

  /**
   * Normalizes an existing numeric input string when switching to this currency's [decimalPlaces].
   * Preserves in-progress decimals when already within scale; rounds with [RoundingMode.HALF_EVEN]
   * only when exceeding [decimalPlaces].
   */
  fun normalizeForScale(rawInput: String): String {
    val trimmed = rawInput.trim()
    if (trimmed.isBlank()) return ""
    if (decimalPlaces == 0 && trimmed.endsWith(".")) {
      return trimmed.dropLast(1)
    }
    if (trimmed == ".") return if (decimalPlaces == 0) "" else trimmed
    val dotIndex = trimmed.indexOf('.')
    if (dotIndex < 0) return trimmed
    val fractionalLength = trimmed.length - dotIndex - 1
    if (fractionalLength <= decimalPlaces) return trimmed
    val parsed = trimmed.toBigDecimalOrNull() ?: return ""
    return parsed.setScale(decimalPlaces, RoundingMode.HALF_EVEN).toPlainString()
  }

  /**
   * Formats a [BigDecimal] amount using this currency's [decimalPlaces] and [RoundingMode.HALF_EVEN]
   * without the currency symbol.
   */
  fun formatPlainNumber(value: BigDecimal, locale: Locale = Locale.getDefault()): String {
    val scaled = value.setScale(decimalPlaces, RoundingMode.HALF_EVEN)
    val symbols = DecimalFormatSymbols(locale)
    val pattern = buildString {
      append("#,##0")
      if (decimalPlaces > 0) {
        append(".")
        repeat(decimalPlaces) { append("0") }
      }
    }
    return DecimalFormat(pattern, symbols).format(scaled)
  }

  companion object {
    private val ISO_CODE_REGEX = Regex("^[A-Z]{3}$")

    // Zero-decimal currencies
    val JPY = Currency("JPY", "Japanese Yen", "¥", 0, "🇯🇵")
    val KRW = Currency("KRW", "South Korean Won", "₩", 0, "🇰🇷")

    // Two-decimal currencies
    val USD = Currency("USD", "US Dollar", "$", 2, "🇺🇸")
    val EUR = Currency("EUR", "Euro", "€", 2, "🇪🇺")
    val GBP = Currency("GBP", "British Pound", "£", 2, "🇬🇧")
    val INR = Currency("INR", "Indian Rupee", "₹", 2, "🇮🇳")
    val CAD = Currency("CAD", "Canadian Dollar", "CA$", 2, "🇨🇦")
    val AUD = Currency("AUD", "Australian Dollar", "A$", 2, "🇦🇺")
    val SGD = Currency("SGD", "Singapore Dollar", "S$", 2, "🇸🇬")
    val CHF = Currency("CHF", "Swiss Franc", "CHF", 2, "🇨🇭")
    val CNY = Currency("CNY", "Chinese Yuan", "¥", 2, "🇨🇳")
    val THB = Currency("THB", "Thai Baht", "฿", 2, "🇹🇭")

    // Three-decimal currencies (ISO 4217 minor unit = 3)
    val KWD = Currency("KWD", "Kuwaiti Dinar", "KD", 3, "🇰🇼")
    val BHD = Currency("BHD", "Bahraini Dinar", "BD", 3, "🇧🇭")
    val OMR = Currency("OMR", "Omani Rial", "OMR", 3, "🇴🇲")
    val JOD = Currency("JOD", "Jordanian Dinar", "JD", 3, "🇯🇴")
    val TND = Currency("TND", "Tunisian Dinar", "TD", 3, "🇹🇳")

    val DEFAULT_CURRENCIES: List<Currency> = listOf(
      USD, EUR, GBP, INR, JPY, CAD, AUD, SGD, CHF, CNY, KRW, THB,
      KWD, BHD, OMR, JOD, TND
    )

    private val defaultByCode: Map<String, Currency> by lazy {
      DEFAULT_CURRENCIES.associateBy { it.code }
    }

    /**
     * Full catalog of circulating ISO 4217 currencies, ordered with [DEFAULT_CURRENCIES] first
     * followed by remaining valid ISO currencies sorted alphabetically by code.
     */
    val ALL_ISO_CURRENCIES: List<Currency> by lazy {
      val extras = try {
        java.util.Currency.getAvailableCurrencies()
          .asSequence()
          .filter { iso ->
            iso.currencyCode.matches(ISO_CODE_REGEX) &&
              iso.defaultFractionDigits >= 0 &&
              !defaultByCode.containsKey(iso.currencyCode)
          }
          .map { fromJavaCurrency(it) }
          .sortedBy { it.code }
          .toList()
      } catch (_: Exception) {
        emptyList()
      }
      DEFAULT_CURRENCIES + extras
    }

    /**
     * Resolves an ISO 4217 currency code to a [Currency], checking [DEFAULT_CURRENCIES] first
     * and falling back to [java.util.Currency]. Returns `null` for blank, malformed, non-monetary,
     * or unsupported codes without substituting another currency.
     */
    fun findByCode(code: String): Currency? {
      val normalized = code.trim().uppercase(Locale.US)
      if (!normalized.matches(ISO_CODE_REGEX)) return null

      defaultByCode[normalized]?.let { return it }

      return try {
        val iso = java.util.Currency.getInstance(normalized)
        if (iso.defaultFractionDigits < 0) return null
        fromJavaCurrency(iso)
      } catch (_: IllegalArgumentException) {
        null
      }
    }

    /**
     * Explicit variant of [findByCode] that throws [IllegalArgumentException] when [code]
     * is unknown or unsupported instead of returning `null` or substituting a fallback currency.
     */
    fun requireByCode(code: String): Currency =
      findByCode(code) ?: throw IllegalArgumentException("Unsupported or unknown ISO 4217 currency code: '$code'")

    private fun fromJavaCurrency(iso: java.util.Currency): Currency {
      val code = iso.currencyCode
      val displayName = try {
        iso.getDisplayName(Locale.US).takeIf { it.isNotBlank() } ?: code
      } catch (_: Exception) {
        code
      }
      val symbol = try {
        iso.getSymbol(Locale.US).takeIf { it.isNotBlank() } ?: code
      } catch (_: Exception) {
        code
      }
      return Currency(
        code = code,
        name = displayName,
        symbol = symbol,
        decimalPlaces = iso.defaultFractionDigits,
        flagEmoji = ""
      )
    }
  }
}
