package com.pluto.app.settings

import com.pluto.app.data.remote.cloud.CloudUserSettings
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.BudgetCycleType
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.TripSettings
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class MonetarySettingsSerializationTest {

  @Test
  fun `cloud user settings create map serializes all monetary values as decimal strings and round-trips losslessly`() {
    val domain = UserSettings(
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      persona = UserPersona.INTERNATIONAL_STUDENT,
      budgetCycleType = BudgetCycleType.ACADEMIC_TERM,
      academicTermSettings = AcademicTermSettings(
        termName = "Spring 2027",
        termStartDate = 1_700_000_000_000L,
        termEndDate = 1_708_000_000_000L,
        totalAllowanceHome = BigDecimal("6123.45"),
        tuitionAndFixedCommittedHome = BigDecimal("1543.21")
      ),
      tripSettings = TripSettings(
        tripName = "Euro Rail",
        tripStartDate = 1_700_000_000_000L,
        tripEndDate = 1_701_200_000_000L,
        totalTripBudgetHome = BigDecimal("888.75")
      ),
      dailySpendingCap = BigDecimal("49.99"),
      monthlySpendingCap = BigDecimal("1499.95"),
      safeToSpendWarningThreshold = BigDecimal("19.95"),
      categoryMonthlyBudgets = mapOf(
        Category.FOOD.id to BigDecimal("320.50"),
        Category.TRANSPORT.id to BigDecimal("89.25")
      ),
      isOnboardingCompleted = true
    )

    val createMap = CloudUserSettings.toCreateMap("user-123", domain)
    assertEquals("49.99", createMap["dailySpendingCap"])
    assertEquals("1499.95", createMap["monthlySpendingCap"])
    assertEquals("19.95", createMap["safeToSpendWarningThreshold"])
    assertEquals("6123.45", createMap["totalAllowanceHome"])
    assertEquals("1543.21", createMap["tuitionAndFixedCommittedHome"])
    assertEquals("888.75", createMap["totalTripBudgetHome"])

    @Suppress("UNCHECKED_CAST")
    val budgetsMap = createMap["categoryMonthlyBudgets"] as Map<String, Any>
    assertEquals("320.50", budgetsMap[Category.FOOD.id])
    assertEquals("89.25", budgetsMap[Category.TRANSPORT.id])

    val roundTripped = CloudUserSettings.fromRawMap(
      id = "settings",
      data = createMap,
      createdAt = Timestamp(1_700_000_000L, 0),
      updatedAt = Timestamp(1_700_000_100L, 0)
    ).toDomain()

    assertEquals(BigDecimal("49.99"), roundTripped.dailySpendingCap)
    assertEquals(BigDecimal("1499.95"), roundTripped.monthlySpendingCap)
    assertEquals(BigDecimal("19.95"), roundTripped.safeToSpendWarningThreshold)
    assertEquals(BigDecimal("6123.45"), roundTripped.academicTermSettings.totalAllowanceHome)
    assertEquals(BigDecimal("1543.21"), roundTripped.academicTermSettings.tuitionAndFixedCommittedHome)
    assertEquals(BigDecimal("888.75"), roundTripped.tripSettings.totalTripBudgetHome)
    assertEquals(BigDecimal("320.50"), roundTripped.categoryMonthlyBudgets[Category.FOOD.id])
    assertEquals(BigDecimal("89.25"), roundTripped.categoryMonthlyBudgets[Category.TRANSPORT.id])
  }

  @Test
  fun `cloud user settings backward-compatibly parses legacy Firestore numeric payloads`() {
    val legacyFirestoreData: Map<String, Any?> = mapOf(
      "userId" to "legacy-user",
      "homeCurrencyCode" to "USD",
      "destinationCurrencyCode" to "JPY",
      "dailySpendingCap" to 75.5,
      "monthlySpendingCap" to 2500L,
      "safeToSpendWarningThreshold" to 15.25,
      "totalAllowanceHome" to 6000.0,
      "tuitionAndFixedCommittedHome" to 1500L,
      "totalTripBudgetHome" to 1200.75,
      "categoryMonthlyBudgets" to mapOf(
        Category.FOOD.id to 250.5,
        Category.TRANSPORT.id to 100L
      )
    )

    val domain = CloudUserSettings.fromRawMap(
      id = "settings",
      data = legacyFirestoreData
    ).toDomain()

    assertEquals(0, BigDecimal("75.5").compareTo(domain.dailySpendingCap))
    assertEquals(0, BigDecimal("2500").compareTo(domain.monthlySpendingCap))
    assertEquals(0, BigDecimal("15.25").compareTo(domain.safeToSpendWarningThreshold))
    assertEquals(0, BigDecimal("6000").compareTo(domain.academicTermSettings.totalAllowanceHome))
    assertEquals(0, BigDecimal("1500").compareTo(domain.academicTermSettings.tuitionAndFixedCommittedHome))
    assertEquals(0, BigDecimal("1200.75").compareTo(domain.tripSettings.totalTripBudgetHome))
    assertEquals(0, BigDecimal("250.5").compareTo(domain.categoryMonthlyBudgets[Category.FOOD.id]))
    assertEquals(0, BigDecimal("100").compareTo(domain.categoryMonthlyBudgets[Category.TRANSPORT.id]))
  }

  @Test
  fun `cloud user settings update map deletes cleared caps and warning threshold`() {
    val cleared = UserSettings(
      dailySpendingCap = null,
      monthlySpendingCap = BigDecimal.ZERO,
      safeToSpendWarningThreshold = null
    )

    val updateMap = CloudUserSettings.toUpdateMap(cleared)
    assertEquals(FieldValue.delete(), updateMap["dailySpendingCap"])
    assertEquals(FieldValue.delete(), updateMap["monthlySpendingCap"])
    assertEquals(FieldValue.delete(), updateMap["safeToSpendWarningThreshold"])

    // Parsing a payload with explicit null threshold yields null (not default 20.00)
    val explicitNullPayload: Map<String, Any?> = mapOf(
      "safeToSpendWarningThreshold" to null
    )
    val parsed = CloudUserSettings.fromRawMap(id = "settings", data = explicitNullPayload).toDomain()
    assertNull(parsed.safeToSpendWarningThreshold)
    assertTrue(parsed.categoryMonthlyBudgets.isEmpty())
  }

  @Test
  fun `cloud raw parsing normalizes home time zone against home currency`() {
    fun parsedZone(currencyCode: String, zoneId: String): String? =
      CloudUserSettings.fromRawMap(
        id = "settings",
        data = mapOf(
          "homeCurrencyCode" to currencyCode,
          "homeTimeZoneId" to zoneId
        )
      ).toDomain().homeTimeZoneId

    assertNull(parsedZone("USD", "America/New_York"))
    assertNull(parsedZone("USD", "Not/AZone"))
    assertNull(parsedZone("USD", "  "))
    assertEquals("Asia/Kolkata", parsedZone("USD", " Asia/Kolkata "))
    assertNull(parsedZone("INR", "Asia/Kolkata"))
  }

  @Test
  fun `cloud maps omit invalid or default home time zone and keep custom cities`() {
    val defaulted = UserSettings(
      homeCurrency = Currency.USD,
      homeTimeZoneId = "America/New_York"
    )
    assertFalse(CloudUserSettings.toCreateMap("user-123", defaulted).containsKey("homeTimeZoneId"))
    assertEquals(
      FieldValue.delete(),
      CloudUserSettings.toUpdateMap(defaulted)["homeTimeZoneId"]
    )

    val custom = UserSettings(
      homeCurrency = Currency.USD,
      homeTimeZoneId = "Asia/Kolkata"
    )
    assertEquals("Asia/Kolkata", CloudUserSettings.toCreateMap("user-123", custom)["homeTimeZoneId"])
    assertEquals("Asia/Kolkata", CloudUserSettings.toUpdateMap(custom)["homeTimeZoneId"])
  }
}
