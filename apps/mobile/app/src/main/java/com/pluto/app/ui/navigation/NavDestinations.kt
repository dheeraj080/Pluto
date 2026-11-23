package com.pluto.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Insights
import androidx.compose.material.icons.rounded.Savings
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.Serializable

/**
 * Type-safe @Serializable routes for Jetpack Navigation Compose.
 */
@Serializable
data object HomeRoute

@Serializable
data object ExpensesRoute

@Serializable
data object BudgetsRoute

@Serializable
data object InsightsRoute

@Serializable
data object SettingsRoute

@Serializable
data object ConverterRoute

@Serializable
data object WalletsRoute

@Serializable
data class WalletDetailRoute(val walletId: String)

@Serializable
enum class CurrencyPickerTarget {
  HOME,
  DESTINATION,
  CONVERTER_SOURCE,
  CONVERTER_TARGET,
  EXPENSE_LOCAL,
  EXPENSE_HOME,
  WALLET
}

@Serializable
data class CurrencyPickerRoute(val target: CurrencyPickerTarget)

/**
 * Top-level destinations of the application shell adaptive navigation.
 */
enum class TopLevelDestination(
  val route: String,
  val navRoute: Any,
  val title: String,
  val selectedIcon: ImageVector,
  val unselectedIcon: ImageVector
) {
  HOME(
    route = "home",
    navRoute = HomeRoute,
    title = "Home",
    selectedIcon = Icons.Rounded.Home,
    unselectedIcon = Icons.Outlined.Home
  ),
  EXPENSES(
    route = "expenses",
    navRoute = ExpensesRoute,
    title = "Transactions",
    selectedIcon = Icons.AutoMirrored.Rounded.ReceiptLong,
    unselectedIcon = Icons.AutoMirrored.Outlined.ReceiptLong
  ),
  BUDGETS(
    route = "budgets",
    navRoute = BudgetsRoute,
    title = "Budgets",
    selectedIcon = Icons.Rounded.Savings,
    unselectedIcon = Icons.Outlined.Savings
  ),
  INSIGHTS(
    route = "insights",
    navRoute = InsightsRoute,
    title = "Insights",
    selectedIcon = Icons.Rounded.Insights,
    unselectedIcon = Icons.Outlined.Insights
  )
}

/**
 * Legacy sealed class kept for backward test compatibility.
 */
sealed class Screen(val route: String) {
  data object Onboarding : Screen("onboarding")
  data object MainShell : Screen("main_shell")
  data object CurrencySelection : Screen("currency_selection")
}
