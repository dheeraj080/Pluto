package com.pluto.app.navigation

import com.pluto.app.ui.navigation.BudgetsRoute
import com.pluto.app.ui.navigation.ConverterRoute
import com.pluto.app.ui.navigation.CurrencyPickerRoute
import com.pluto.app.ui.navigation.CurrencyPickerTarget
import com.pluto.app.ui.navigation.ExpensesRoute
import com.pluto.app.ui.navigation.HomeRoute
import com.pluto.app.ui.navigation.InsightsRoute
import com.pluto.app.ui.navigation.SettingsRoute
import com.pluto.app.ui.navigation.TopLevelDestination
import com.pluto.app.ui.navigation.WalletDetailRoute
import com.pluto.app.ui.navigation.WalletsRoute
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NavDestinationsTest {

  private val json = Json { encodeDefaults = true }

  @Test
  fun `top level destinations map to all four primary routes`() {
    val entries = TopLevelDestination.entries
    assertEquals(4, entries.size)
    assertEquals(HomeRoute, TopLevelDestination.HOME.navRoute)
    assertEquals(ExpensesRoute, TopLevelDestination.EXPENSES.navRoute)
    assertEquals(BudgetsRoute, TopLevelDestination.BUDGETS.navRoute)
    assertEquals(InsightsRoute, TopLevelDestination.INSIGHTS.navRoute)
  }

  @Test
  fun `serializable object and data class routes round-trip through kotlinx serialization`() {
    val walletDetail = WalletDetailRoute(walletId = "wallet-eur-01")
    val encodedWallet = json.encodeToString(walletDetail)
    val decodedWallet = json.decodeFromString<WalletDetailRoute>(encodedWallet)
    assertEquals(walletDetail, decodedWallet)

    CurrencyPickerTarget.entries.forEach { target ->
      val route = CurrencyPickerRoute(target = target)
      val encoded = json.encodeToString(route)
      val decoded = json.decodeFromString<CurrencyPickerRoute>(encoded)
      assertEquals(route, decoded)
    }

    assertTrue(json.encodeToString(HomeRoute).isNotBlank())
    assertTrue(json.encodeToString(SettingsRoute).isNotBlank())
    assertTrue(json.encodeToString(ConverterRoute).isNotBlank())
    assertTrue(json.encodeToString(WalletsRoute).isNotBlank())
  }
}
