package com.pluto.app.ui

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.usecase.CreateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.CreateWalletDepositUseCase
import com.pluto.app.domain.usecase.CreateWalletTransferUseCase
import com.pluto.app.domain.usecase.CreateWalletWithdrawalUseCase
import com.pluto.app.domain.usecase.DeleteCurrencyWalletUseCase
import com.pluto.app.domain.usecase.GetPortfolioValuationUseCase
import com.pluto.app.domain.usecase.ObserveCurrencyWalletsUseCase
import com.pluto.app.domain.usecase.ObserveWalletTransactionsUseCase
import com.pluto.app.domain.usecase.UpdateCurrencyWalletUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.ui.home.StackedCardsHero
import com.pluto.app.ui.navigation.TopLevelDestination
import com.pluto.app.ui.theme.DeepEmeraldHeroBorder
import com.pluto.app.ui.theme.DeepEmeraldHeroOnSurface
import com.pluto.app.ui.theme.DeepEmeraldHeroSurface
import com.pluto.app.ui.theme.ForestPrimary
import com.pluto.app.ui.theme.LuminousMintPrimary
import com.pluto.app.ui.theme.PlutoExtendedColors
import com.pluto.app.ui.theme.PlutoTheme
import com.pluto.app.ui.theme.PlutoThemeDefaults
import com.pluto.app.ui.wallet.WalletViewModel
import com.pluto.app.ui.wallet.WalletsLoadState
import com.pluto.app.wallet.FakeCurrencyWalletRepository
import com.pluto.app.wallet.FakeWalletTransactionRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class Phase1FoundationUiTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private fun createWalletViewModel(): WalletViewModel {
    val walletRepo = FakeCurrencyWalletRepository()
    val txRepo = FakeWalletTransactionRepository(walletRepo)
    val exchangeRepo = FakeExchangeRateRepository()
    val settingsRepo = FakeUserSettingsRepository(
      UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR)
    )
    return WalletViewModel(
      observeCurrencyWalletsUseCase = ObserveCurrencyWalletsUseCase(walletRepo),
      createCurrencyWalletUseCase = CreateCurrencyWalletUseCase(walletRepo),
      updateCurrencyWalletUseCase = UpdateCurrencyWalletUseCase(walletRepo),
      deleteCurrencyWalletUseCase = DeleteCurrencyWalletUseCase(walletRepo),
      getPortfolioValuationUseCase = GetPortfolioValuationUseCase(exchangeRepo),
      createWalletDepositUseCase = CreateWalletDepositUseCase(walletRepo, txRepo),
      createWalletWithdrawalUseCase = CreateWalletWithdrawalUseCase(walletRepo, txRepo),
      createWalletTransferUseCase = CreateWalletTransferUseCase(walletRepo, txRepo, exchangeRepo),
      observeWalletTransactionsUseCase = ObserveWalletTransactionsUseCase(txRepo),
      userSettingsRepository = settingsRepo
    )
  }

  @Test
  fun `wallet detail route shows loading state before wallets finish initializing`() {
    val walletViewModel = createWalletViewModel()
    composeTestRule.setContent {
      PlutoTheme {
        WalletDetailRouteContent(
          walletId = "wallet-eur-1",
          walletsLoadState = WalletsLoadState.Loading,
          walletViewModel = walletViewModel,
          onNavigateBack = {},
          onRecoverToWalletList = {}
        )
      }
    }

    composeTestRule.onNodeWithTag("wallet_detail_loading").assertIsDisplayed()
    composeTestRule.onNodeWithTag("wallet_detail_loading_indicator").assertIsDisplayed()
    composeTestRule.onNodeWithText("Loading wallet details...").assertIsDisplayed()
    composeTestRule.onNodeWithTag("wallet_detail_not_found").assertDoesNotExist()
  }

  @Test
  fun `wallet detail route shows not found recovery state when wallet id is missing after load`() {
    val walletViewModel = createWalletViewModel()
    var recoveredCount = 0

    composeTestRule.setContent {
      PlutoTheme {
        WalletDetailRouteContent(
          walletId = "deleted-wallet-99",
          walletsLoadState = WalletsLoadState.Loaded(emptyList()),
          walletViewModel = walletViewModel,
          onNavigateBack = {},
          onRecoverToWalletList = { recoveredCount += 1 }
        )
      }
    }

    composeTestRule.onNodeWithTag("wallet_detail_not_found").assertIsDisplayed()
    composeTestRule.onNodeWithText("Wallet not found").assertIsDisplayed()
    composeTestRule.onNodeWithTag("wallet_not_found_back_button")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertEquals(1, recoveredCount)
  }

  @Test
  fun `wallet detail route renders wallet content when wallet exists`() {
    val eurWallet = CurrencyWallet(
      id = "wallet-eur-1",
      currency = Currency.EUR,
      balance = Money.of("420.50", Currency.EUR)
    )
    val walletViewModel = createWalletViewModel()

    composeTestRule.setContent {
      PlutoTheme {
        WalletDetailRouteContent(
          walletId = eurWallet.id,
          walletsLoadState = WalletsLoadState.Loaded(listOf(eurWallet)),
          walletViewModel = walletViewModel,
          onNavigateBack = {},
          onRecoverToWalletList = {}
        )
      }
    }

    composeTestRule.onNodeWithTag("wallet_detail_loading").assertDoesNotExist()
    composeTestRule.onNodeWithTag("wallet_detail_not_found").assertDoesNotExist()
    composeTestRule.onNodeWithText("EUR Ledger").assertIsDisplayed()
  }

  @Test
  fun `pluto navigation bar renders all 4 tabs with 48dp targets and updates selection`() {
    var selected by mutableStateOf(TopLevelDestination.HOME)

    composeTestRule.setContent {
      PlutoTheme {
        PlutoNavigationBar(
          selectedTab = selected,
          onTabSelected = { selected = it }
        )
      }
    }

    composeTestRule.onNodeWithTag("main_bottom_nav_bar").assertIsDisplayed()
    TopLevelDestination.entries.forEach { destination ->
      composeTestRule.onNodeWithTag("nav_tab_${destination.name.lowercase()}")
        .assertIsDisplayed()
        .assertHeightIsAtLeast(48.dp)
      composeTestRule.onNodeWithText(destination.title).assertIsDisplayed()
    }

    composeTestRule.onNodeWithTag("nav_tab_home").assertIsSelected()
    composeTestRule.onNodeWithTag("nav_tab_insights").performClick()
    assertEquals(TopLevelDestination.INSIGHTS, selected)
    composeTestRule.onNodeWithTag("nav_tab_insights").assertIsSelected()
  }

  @Test
  fun `pluto navigation bar remains readable at 1_8x font scale`() {
    composeTestRule.setContent {
      PlutoTheme {
        val currentDensity = LocalDensity.current
        CompositionLocalProvider(
          LocalDensity provides Density(density = currentDensity.density, fontScale = 1.8f)
        ) {
          PlutoNavigationBar(
            selectedTab = TopLevelDestination.EXPENSES,
            onTabSelected = {}
          )
        }
      }
    }

    TopLevelDestination.entries.forEach { destination ->
      composeTestRule.onNodeWithTag("nav_tab_${destination.name.lowercase()}")
        .assertIsDisplayed()
        .assertHeightIsAtLeast(48.dp)
      composeTestRule.onNodeWithText(destination.title).assertIsDisplayed()
    }
  }

  @Test
  fun `dark mode hero card uses deep emerald surface instead of luminous mint and light mode stays forest primary`() {
    var lightExtended by mutableStateOf<PlutoExtendedColors?>(null)
    var darkExtended by mutableStateOf<PlutoExtendedColors?>(null)
    val settings = UserSettings(
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.JPY,
      isOnboardingCompleted = true
    )
    val summary = DashboardSummary(
      period = DashboardPeriod.THIS_MONTH,
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.JPY,
      totalHomeSpending = Money.zero(Currency.USD),
      transactionCount = 0,
      categoryBreakdowns = emptyList(),
      currencyBreakdowns = emptyList(),
      recentExpenses = emptyList(),
      hasExpensesInPeriod = false,
      totalAllTimeExpensesCount = 0,
      todayHomeSpending = Money.zero(Currency.USD),
      monthHomeSpending = Money.zero(Currency.USD),
      safeToSpendTodayHome = Money.of("45.00", Currency.USD)
    )
    val wallets = listOf(
      CurrencyWallet(
        id = "w-jpy",
        currency = Currency.JPY,
        balance = Money.of("25000", Currency.JPY)
      )
    )
    var darkThemeEnabled by mutableStateOf(true)

    composeTestRule.setContent {
      PlutoTheme(darkTheme = darkThemeEnabled) {
        val ext = PlutoThemeDefaults.extendedColors
        if (darkThemeEnabled) {
          darkExtended = ext
        } else {
          lightExtended = ext
        }
        StackedCardsHero(
          summary = summary,
          portfolioValuation = null,
          userSettings = settings,
          wallets = wallets
        )
      }
    }

    composeTestRule.onNodeWithTag("main_wallet_hero_card").assertIsDisplayed()
    composeTestRule.onNodeWithTag("hero_travel_balance_amount", useUnmergedTree = true).assertIsDisplayed()
    composeTestRule.onNodeWithTag("stacked_card_adjust_budget_button").assertIsDisplayed()

    val resolvedDark = darkExtended!!
    assertTrue(resolvedDark.isDark)
    assertEquals(DeepEmeraldHeroSurface, resolvedDark.heroContainer)
    assertNotEquals(LuminousMintPrimary, resolvedDark.heroContainer)
    assertEquals(DeepEmeraldHeroOnSurface, resolvedDark.onHeroContainer)
    assertEquals(DeepEmeraldHeroBorder, resolvedDark.heroBorder)

    darkThemeEnabled = false
    composeTestRule.waitForIdle()

    val resolvedLight = lightExtended!!
    assertEquals(ForestPrimary, resolvedLight.heroContainer)
    assertEquals(Color.White, resolvedLight.onHeroContainer)
    assertNull(resolvedLight.heroBorder)
  }
}
