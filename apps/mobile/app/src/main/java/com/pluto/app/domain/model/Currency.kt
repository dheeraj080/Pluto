package com.pluto.app.domain.model

/**
 * Canonical Currency model identified strictly by ISO 4217 code.
 *
 * @property code Canonical 3-letter ISO 4217 currency code (e.g., "USD", "EUR", "JPY", "INR").
 * @property name Human-readable display name (e.g., "US Dollar", "Japanese Yen").
 * @property symbol Currency symbol (e.g., "$", "€", "¥", "₹").
 * @property decimalPlaces Standard decimal places for display and calculation (e.g., 2 for USD, 0 for JPY, 3 for BHD).
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

  companion object {
    // Default widely used currencies for travelers, expats, and international students
    val USD = Currency("USD", "US Dollar", "$", 2, "🇺🇸")
    val EUR = Currency("EUR", "Euro", "€", 2, "🇪🇺")
    val GBP = Currency("GBP", "British Pound", "£", 2, "🇬🇧")
    val INR = Currency("INR", "Indian Rupee", "₹", 2, "🇮🇳")
    val JPY = Currency("JPY", "Japanese Yen", "¥", 0, "🇯🇵")
    val CAD = Currency("CAD", "Canadian Dollar", "CA$", 2, "🇨🇦")
    val AUD = Currency("AUD", "Australian Dollar", "A$", 2, "🇦🇺")
    val SGD = Currency("SGD", "Singapore Dollar", "S$", 2, "🇸🇬")
    val CHF = Currency("CHF", "Swiss Franc", "CHF", 2, "🇨🇭")
    val CNY = Currency("CNY", "Chinese Yuan", "¥", 2, "🇨🇳")
    val KRW = Currency("KRW", "South Korean Won", "₩", 0, "🇰🇷")
    val THB = Currency("THB", "Thai Baht", "฿", 2, "🇹🇭")

    val DEFAULT_CURRENCIES: List<Currency> = listOf(
      USD, EUR, GBP, INR, JPY, CAD, AUD, SGD, CHF, CNY, KRW, THB
    )

    fun findByCode(code: String): Currency? {
      val normalized = code.trim().uppercase()
      return DEFAULT_CURRENCIES.find { it.code == normalized }
    }
  }
}
