package com.pluto.app.domain.model

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs

/**
 * Curated city/time-zone entry for fast search and currency-aware suggestions.
 */
data class TimeZoneOption(
  val zoneId: String,
  val city: String,
  val country: String,
  val currencyCodes: Set<String> = emptySet()
)

/**
 * Rendered item in the reference time-zone picker with a live preview time.
 */
data class TimeZonePickerItem(
  val zoneId: String,
  val city: String,
  val subtitle: String,
  val liveTimeFormatted: String,
  val isDaytime: Boolean,
  val utcOffsetLabel: String,
  val isSelected: Boolean
)

/**
 * Immutable snapshot of the dual-zone clock for the dashboard header.
 */
data class DualClockSnapshot(
  val localLabel: String,
  val localZoneId: String,
  val localTimeFormatted: String,
  val localIsDaytime: Boolean,
  val homeLabel: String,
  val homeZoneId: String,
  val homeTimeFormatted: String,
  val homeIsDaytime: Boolean,
  val offsetBadgeText: String,
  val dayRolloverLabel: String?,
  val isHomeZoneCustomized: Boolean
)

/**
 * Pure Kotlin dual-zone clock, offset, day/night, and city search engine.
 * Uses [java.util.TimeZone] and [java.util.Calendar] for full minSdk 24+ compatibility.
 */
object DualZoneClockEngine {

  val CURATED_ZONES: List<TimeZoneOption> = listOf(
    // North America
    TimeZoneOption("America/New_York", "New York", "United States", setOf("USD")),
    TimeZoneOption("America/Chicago", "Chicago", "United States", setOf("USD")),
    TimeZoneOption("America/Denver", "Denver", "United States", setOf("USD")),
    TimeZoneOption("America/Los_Angeles", "Los Angeles", "United States", setOf("USD")),
    TimeZoneOption("America/Phoenix", "Phoenix", "United States", setOf("USD")),
    TimeZoneOption("America/Anchorage", "Anchorage", "United States", setOf("USD")),
    TimeZoneOption("Pacific/Honolulu", "Honolulu", "United States", setOf("USD")),
    TimeZoneOption("America/Toronto", "Toronto", "Canada", setOf("CAD")),
    TimeZoneOption("America/Vancouver", "Vancouver", "Canada", setOf("CAD")),
    TimeZoneOption("America/Montreal", "Montreal", "Canada", setOf("CAD")),
    TimeZoneOption("America/Edmonton", "Calgary", "Canada", setOf("CAD")),
    TimeZoneOption("America/Mexico_City", "Mexico City", "Mexico"),

    // Europe
    TimeZoneOption("Europe/London", "London", "United Kingdom", setOf("GBP")),
    TimeZoneOption("Europe/Dublin", "Dublin", "Ireland", setOf("EUR")),
    TimeZoneOption("Europe/Paris", "Paris", "France", setOf("EUR")),
    TimeZoneOption("Europe/Berlin", "Berlin", "Germany", setOf("EUR")),
    TimeZoneOption("Europe/Amsterdam", "Amsterdam", "Netherlands", setOf("EUR")),
    TimeZoneOption("Europe/Madrid", "Madrid", "Spain", setOf("EUR")),
    TimeZoneOption("Europe/Rome", "Rome", "Italy", setOf("EUR")),
    TimeZoneOption("Europe/Lisbon", "Lisbon", "Portugal", setOf("EUR")),
    TimeZoneOption("Europe/Brussels", "Brussels", "Belgium", setOf("EUR")),
    TimeZoneOption("Europe/Vienna", "Vienna", "Austria", setOf("EUR")),
    TimeZoneOption("Europe/Zurich", "Zurich", "Switzerland", setOf("CHF")),
    TimeZoneOption("Europe/Stockholm", "Stockholm", "Sweden"),
    TimeZoneOption("Europe/Oslo", "Oslo", "Norway"),
    TimeZoneOption("Europe/Copenhagen", "Copenhagen", "Denmark"),
    TimeZoneOption("Europe/Warsaw", "Warsaw", "Poland"),
    TimeZoneOption("Europe/Prague", "Prague", "Czechia"),
    TimeZoneOption("Europe/Athens", "Athens", "Greece", setOf("EUR")),
    TimeZoneOption("Europe/Istanbul", "Istanbul", "Turkey"),

    // Asia & Middle East
    TimeZoneOption("Asia/Kolkata", "Mumbai / Delhi", "India", setOf("INR")),
    TimeZoneOption("Asia/Tokyo", "Tokyo", "Japan", setOf("JPY")),
    TimeZoneOption("Asia/Singapore", "Singapore", "Singapore", setOf("SGD")),
    TimeZoneOption("Asia/Seoul", "Seoul", "South Korea", setOf("KRW")),
    TimeZoneOption("Asia/Shanghai", "Shanghai / Beijing", "China", setOf("CNY")),
    TimeZoneOption("Asia/Hong_Kong", "Hong Kong", "China"),
    TimeZoneOption("Asia/Taipei", "Taipei", "Taiwan"),
    TimeZoneOption("Asia/Bangkok", "Bangkok", "Thailand", setOf("THB")),
    TimeZoneOption("Asia/Jakarta", "Jakarta", "Indonesia"),
    TimeZoneOption("Asia/Manila", "Manila", "Philippines"),
    TimeZoneOption("Asia/Kuala_Lumpur", "Kuala Lumpur", "Malaysia"),
    TimeZoneOption("Asia/Ho_Chi_Minh", "Ho Chi Minh City", "Vietnam"),
    TimeZoneOption("Asia/Kathmandu", "Kathmandu", "Nepal"),
    TimeZoneOption("Asia/Colombo", "Colombo", "Sri Lanka"),
    TimeZoneOption("Asia/Dhaka", "Dhaka", "Bangladesh"),
    TimeZoneOption("Asia/Karachi", "Karachi", "Pakistan"),
    TimeZoneOption("Asia/Dubai", "Dubai", "UAE"),
    TimeZoneOption("Asia/Riyadh", "Riyadh", "Saudi Arabia"),
    TimeZoneOption("Asia/Jerusalem", "Tel Aviv", "Israel"),
    TimeZoneOption("Asia/Kuwait", "Kuwait City", "Kuwait", setOf("KWD")),
    TimeZoneOption("Asia/Bahrain", "Manama", "Bahrain", setOf("BHD")),
    TimeZoneOption("Asia/Muscat", "Muscat", "Oman", setOf("OMR")),
    TimeZoneOption("Asia/Amman", "Amman", "Jordan", setOf("JOD")),

    // Oceania
    TimeZoneOption("Australia/Sydney", "Sydney", "Australia", setOf("AUD")),
    TimeZoneOption("Australia/Melbourne", "Melbourne", "Australia", setOf("AUD")),
    TimeZoneOption("Australia/Brisbane", "Brisbane", "Australia", setOf("AUD")),
    TimeZoneOption("Australia/Perth", "Perth", "Australia", setOf("AUD")),
    TimeZoneOption("Australia/Adelaide", "Adelaide", "Australia", setOf("AUD")),
    TimeZoneOption("Pacific/Auckland", "Auckland", "New Zealand"),

    // South America & Africa
    TimeZoneOption("America/Sao_Paulo", "São Paulo", "Brazil"),
    TimeZoneOption("America/Argentina/Buenos_Aires", "Buenos Aires", "Argentina"),
    TimeZoneOption("America/Bogota", "Bogota", "Colombia"),
    TimeZoneOption("America/Santiago", "Santiago", "Chile"),
    TimeZoneOption("Africa/Cairo", "Cairo", "Egypt"),
    TimeZoneOption("Africa/Johannesburg", "Johannesburg", "South Africa"),
    TimeZoneOption("Africa/Lagos", "Lagos", "Nigeria"),
    TimeZoneOption("Africa/Nairobi", "Nairobi", "Kenya"),
    TimeZoneOption("Africa/Tunis", "Tunis", "Tunisia", setOf("TND")),
    TimeZoneOption("UTC", "UTC", "Coordinated Universal Time")
  )

  private val curatedById: Map<String, TimeZoneOption> = CURATED_ZONES.associateBy { it.zoneId }

  private val currencyDefaultZones: Map<String, String> = mapOf(
    "USD" to "America/New_York",
    "EUR" to "Europe/Berlin",
    "GBP" to "Europe/London",
    "INR" to "Asia/Kolkata",
    "JPY" to "Asia/Tokyo",
    "CAD" to "America/Toronto",
    "AUD" to "Australia/Sydney",
    "SGD" to "Asia/Singapore",
    "CHF" to "Europe/Zurich",
    "CNY" to "Asia/Shanghai",
    "KRW" to "Asia/Seoul",
    "THB" to "Asia/Bangkok",
    "KWD" to "Asia/Kuwait",
    "BHD" to "Asia/Bahrain",
    "OMR" to "Asia/Muscat",
    "JOD" to "Asia/Amman",
    "TND" to "Africa/Tunis"
  )

  fun defaultZoneIdForCurrency(currency: Currency): String {
    return currencyDefaultZones[currency.code.uppercase(Locale.US)] ?: "UTC"
  }

  fun hasCurrencyDefaultForCurrency(currency: Currency): Boolean {
    return currencyDefaultZones.containsKey(currency.code.uppercase(Locale.US))
  }

  /**
   * Normalizes a stored home time zone to the invariant used everywhere in the app:
   * `null` means "derive from home currency", and a non-null value must be a valid
   * IANA zone that differs from the current currency default.
   */
  fun normalizeHomeTimeZoneId(timeZoneId: String?, homeCurrency: Currency): String? {
    val trimmed = timeZoneId?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    if (!isValidZoneId(trimmed)) return null
    if (trimmed == defaultZoneIdForCurrency(homeCurrency)) return null
    return trimmed
  }

  fun isValidZoneId(zoneId: String?): Boolean {
    if (zoneId.isNullOrBlank()) return false
    return zoneId in TimeZone.getAvailableIDs()
  }

  fun resolveHomeZoneId(settings: UserSettings): String {
    val custom = settings.homeTimeZoneId?.trim()
    if (!custom.isNullOrBlank() && isValidZoneId(custom)) {
      return custom
    }
    return defaultZoneIdForCurrency(settings.homeCurrency)
  }

  fun suggestedZonesForCurrency(currency: Currency): List<TimeZoneOption> {
    if (!hasCurrencyDefaultForCurrency(currency)) return emptyList()
    val code = currency.code.uppercase(Locale.US)
    return CURATED_ZONES.filter { code in it.currencyCodes }
  }

  fun friendlyCityName(zoneId: String): String {
    curatedById[zoneId]?.let { return it.city }
    val rawSegment = zoneId.substringAfterLast('/').replace('_', ' ')
    return rawSegment.ifBlank { zoneId }
  }

  fun computeSnapshot(
    nowMillis: Long,
    localTimeZone: TimeZone,
    homeTimeZone: TimeZone,
    isHomeZoneCustomized: Boolean,
    is24Hour: Boolean,
    locale: Locale = Locale.getDefault()
  ): DualClockSnapshot {
    val pattern = if (is24Hour) "HH:mm" else "h:mm a"
    val localFormatter = SimpleDateFormat(pattern, locale).apply { timeZone = localTimeZone }
    val homeFormatter = SimpleDateFormat(pattern, locale).apply { timeZone = homeTimeZone }

    val nowDate = Date(nowMillis)
    val localTimeFormatted = localFormatter.format(nowDate)
    val homeTimeFormatted = homeFormatter.format(nowDate)

    val localCal = Calendar.getInstance(localTimeZone, locale).apply { timeInMillis = nowMillis }
    val homeCal = Calendar.getInstance(homeTimeZone, locale).apply { timeInMillis = nowMillis }

    val localHour = localCal.get(Calendar.HOUR_OF_DAY)
    val homeHour = homeCal.get(Calendar.HOUR_OF_DAY)
    val localIsDaytime = localHour in 6..17
    val homeIsDaytime = homeHour in 6..17

    val localOffsetMs = localTimeZone.getOffset(nowMillis)
    val homeOffsetMs = homeTimeZone.getOffset(nowMillis)
    val diffMinutes = (homeOffsetMs - localOffsetMs) / 60_000

    val offsetBadgeText = formatOffsetDifference(diffMinutes)
    val dayRolloverLabel = computeDayRolloverLabel(localCal, homeCal)

    val localShort = localTimeZone.getDisplayName(
      localTimeZone.inDaylightTime(nowDate),
      TimeZone.SHORT,
      locale
    ).takeIf { it.length <= 6 } ?: friendlyCityName(localTimeZone.id)

    val homeCity = friendlyCityName(homeTimeZone.id)

    return DualClockSnapshot(
      localLabel = localShort,
      localZoneId = localTimeZone.id,
      localTimeFormatted = localTimeFormatted,
      localIsDaytime = localIsDaytime,
      homeLabel = homeCity,
      homeZoneId = homeTimeZone.id,
      homeTimeFormatted = homeTimeFormatted,
      homeIsDaytime = homeIsDaytime,
      offsetBadgeText = offsetBadgeText,
      dayRolloverLabel = dayRolloverLabel,
      isHomeZoneCustomized = isHomeZoneCustomized
    )
  }

  fun formatOffsetDifference(diffMinutes: Int): String {
    if (diffMinutes == 0) return "Same time"
    val sign = if (diffMinutes > 0) "+" else "-"
    val absMinutes = abs(diffMinutes)
    val hours = absMinutes / 60
    val mins = absMinutes % 60
    return when {
      mins == 0 -> "$sign${hours}h"
      hours == 0 -> "$sign${mins}m"
      mins == 30 -> "$sign$hours.5h"
      else -> "$sign${hours}h ${mins}m"
    }
  }

  fun formatUtcOffset(timeZone: TimeZone, nowMillis: Long): String {
    val offsetMinutes = timeZone.getOffset(nowMillis) / 60_000
    if (offsetMinutes == 0) return "UTC+0"
    val sign = if (offsetMinutes > 0) "+" else "-"
    val absMinutes = abs(offsetMinutes)
    val hours = absMinutes / 60
    val mins = absMinutes % 60
    return if (mins == 0) {
      "UTC$sign$hours"
    } else {
      String.format(Locale.US, "UTC%s%d:%02d", sign, hours, mins)
    }
  }

  fun searchTimeZones(
    query: String,
    selectedZoneId: String,
    nowMillis: Long,
    is24Hour: Boolean,
    locale: Locale = Locale.getDefault()
  ): List<TimeZonePickerItem> {
    val trimmed = query.trim().lowercase(locale)
    val timePattern = if (is24Hour) "HH:mm" else "h:mm a"
    val formatter = SimpleDateFormat(timePattern, locale)
    val nowDate = Date(nowMillis)

    val curatedMatches = CURATED_ZONES.filter { option ->
      if (trimmed.isEmpty()) {
        true
      } else {
        val tz = TimeZone.getTimeZone(option.zoneId)
        val utcLabel = formatUtcOffset(tz, nowMillis).lowercase(locale)
        val shortName = tz.getDisplayName(tz.inDaylightTime(nowDate), TimeZone.SHORT, locale).lowercase(locale)
        option.city.lowercase(locale).contains(trimmed) ||
          option.country.lowercase(locale).contains(trimmed) ||
          option.zoneId.lowercase(locale).contains(trimmed) ||
          utcLabel.contains(trimmed) ||
          shortName.contains(trimmed)
      }
    }

    val results = curatedMatches.map { option ->
      val tz = TimeZone.getTimeZone(option.zoneId)
      buildPickerItem(
        zoneId = option.zoneId,
        city = option.city,
        country = option.country,
        tz = tz,
        nowMillis = nowMillis,
        nowDate = nowDate,
        formatter = formatter,
        locale = locale,
        isSelected = option.zoneId == selectedZoneId
      )
    }.toMutableList()

    val seenIds = results.map { it.zoneId }.toHashSet()
    // The resolved zone (including a non-curated custom city) is always visible and checked.
    if (isValidZoneId(selectedZoneId) && selectedZoneId !in seenIds) {
      val tz = TimeZone.getTimeZone(selectedZoneId)
      val region = selectedZoneId.substringBefore('/').replace('_', ' ')
      results.add(
        0,
        buildPickerItem(
          zoneId = selectedZoneId,
          city = friendlyCityName(selectedZoneId),
          country = region,
          tz = tz,
          nowMillis = nowMillis,
          nowDate = nowDate,
          formatter = formatter,
          locale = locale,
          isSelected = true
        )
      )
      seenIds.add(selectedZoneId)
    }

    if (trimmed.isNotEmpty() && results.size < 25) {
      val extraIds = TimeZone.getAvailableIDs()
        .asSequence()
        .filter { id ->
          id !in seenIds &&
            !id.startsWith("Etc/") &&
            id.contains('/') &&
            (id.lowercase(locale).contains(trimmed) ||
              formatUtcOffset(TimeZone.getTimeZone(id), nowMillis).lowercase(locale).contains(trimmed))
        }
        .take(25 - results.size)

      for (id in extraIds) {
        if (id in seenIds) continue
        val tz = TimeZone.getTimeZone(id)
        val region = id.substringBefore('/').replace('_', ' ')
        results.add(
          buildPickerItem(
            zoneId = id,
            city = friendlyCityName(id),
            country = region,
            tz = tz,
            nowMillis = nowMillis,
            nowDate = nowDate,
            formatter = formatter,
            locale = locale,
            isSelected = id == selectedZoneId
          )
        )
        seenIds.add(id)
      }
    }

    return results
  }

  private fun buildPickerItem(
    zoneId: String,
    city: String,
    country: String,
    tz: TimeZone,
    nowMillis: Long,
    nowDate: Date,
    formatter: SimpleDateFormat,
    locale: Locale,
    isSelected: Boolean
  ): TimeZonePickerItem {
    formatter.timeZone = tz
    val liveTime = formatter.format(nowDate)
    val cal = Calendar.getInstance(tz, locale).apply { timeInMillis = nowMillis }
    val isDay = cal.get(Calendar.HOUR_OF_DAY) in 6..17
    val utcLabel = formatUtcOffset(tz, nowMillis)
    return TimeZonePickerItem(
      zoneId = zoneId,
      city = city,
      subtitle = "$country · $utcLabel",
      liveTimeFormatted = liveTime,
      isDaytime = isDay,
      utcOffsetLabel = utcLabel,
      isSelected = isSelected
    )
  }

  private fun computeDayRolloverLabel(localCal: Calendar, homeCal: Calendar): String? {
    val localYear = localCal.get(Calendar.YEAR)
    val homeYear = homeCal.get(Calendar.YEAR)
    val localDay = localCal.get(Calendar.DAY_OF_YEAR)
    val homeDay = homeCal.get(Calendar.DAY_OF_YEAR)

    return when {
      homeYear > localYear || (homeYear == localYear && homeDay > localDay) -> "+1d"
      homeYear < localYear || (homeYear == localYear && homeDay < localDay) -> "-1d"
      else -> null
    }
  }
}
