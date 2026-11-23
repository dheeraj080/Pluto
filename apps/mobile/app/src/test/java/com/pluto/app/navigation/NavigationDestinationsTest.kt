package com.pluto.app.navigation

import com.pluto.app.ui.navigation.TopLevelDestination
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationDestinationsTest {

  @Test
  fun `top level destinations configure exactly four primary tabs`() {
    val entries = TopLevelDestination.entries
    assertEquals(4, entries.size)

    assertEquals("Home", TopLevelDestination.HOME.title)
    assertEquals("home", TopLevelDestination.HOME.route)

    assertEquals("Transactions", TopLevelDestination.EXPENSES.title)
    assertEquals("expenses", TopLevelDestination.EXPENSES.route)

    assertEquals("Budgets", TopLevelDestination.BUDGETS.title)
    assertEquals("budgets", TopLevelDestination.BUDGETS.route)

    assertEquals("Insights", TopLevelDestination.INSIGHTS.title)
    assertEquals("insights", TopLevelDestination.INSIGHTS.route)
  }

  @Test
  fun `all destinations have valid selected and unselected icons`() {
    TopLevelDestination.entries.forEach { destination ->
      assertNotNull(destination.selectedIcon)
      assertNotNull(destination.unselectedIcon)
      assertTrue(destination.title.isNotBlank())
      assertTrue(destination.route.isNotBlank())
    }
  }
}
