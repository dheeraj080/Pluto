package com.pluto.app.data.remote.cloud

import com.pluto.app.base.FirestoreEmulatorTestBase
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.util.UUID

class FirestoreSyncRepositoryRuleTest : FirestoreEmulatorTestBase() {

  @Test
  fun upsertAndObserveExpense_authenticatedOwner_succeeds() = runBlocking {
    signInTestUser(ALICE_EMAIL)
    val repo = FirestoreCloudSyncRepository(firestore, auth)
    val expenseId = "exp_${UUID.randomUUID().toString().replace("-", "")}"
    val expense = Expense.create(
      id = expenseId,
      originalAmount = Money.of(BigDecimal("24.50"), Currency.EUR),
      homeCurrency = Currency.USD,
      exchangeRate = ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.USD,
        rate = BigDecimal("1.09"),
        timestamp = 1700000000000L,
        source = "api"
      ),
      category = Category.FOOD,
      merchant = "Boulangerie",
      note = "Breakfast"
    )

    val saveResult = withTimeout(DEFAULT_TIMEOUT_MS) { repo.upsertExpense(expense) }
    assertTrue("Expected upsertExpense to succeed: ${saveResult.exceptionOrNull()}", saveResult.isSuccess)

    val observed = withTimeout(FLOW_TIMEOUT_MS) {
      repo.observeExpenses().first { list -> list.any { it.id == expenseId } }
    }
    assertEquals("Boulangerie", observed.first { it.id == expenseId }.merchant)

    // Update existing expense
    val updated = expense.copy(merchant = "Boulangerie Central")
    val updateResult = withTimeout(DEFAULT_TIMEOUT_MS) { repo.upsertExpense(updated) }
    assertTrue("Expected update upsertExpense to succeed: ${updateResult.exceptionOrNull()}", updateResult.isSuccess)
  }

  @Test
  fun saveAndGetSettings_authenticatedOwner_succeeds() = runBlocking {
    signInTestUser(ALICE_EMAIL)
    val repo = FirestoreCloudSyncRepository(firestore, auth)
    val settings = UserSettings(
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.JPY,
      isOnboardingCompleted = true,
      dailySpendingCap = 75.0,
      monthlySpendingCap = 2000.0,
      homeTimeZoneId = "Asia/Kolkata"
    )

    val saveResult = withTimeout(DEFAULT_TIMEOUT_MS) { repo.saveSettings(settings) }
    assertTrue("Expected saveSettings to succeed: ${saveResult.exceptionOrNull()}", saveResult.isSuccess)

    val loaded = withTimeout(DEFAULT_TIMEOUT_MS) { repo.getSettings() }
    assertTrue(loaded.isSuccess)
    assertEquals(Currency.JPY, loaded.getOrNull()?.destinationCurrency)
    assertEquals("Asia/Kolkata", loaded.getOrNull()?.homeTimeZoneId)

    // Verify clearing homeTimeZoneId back to null succeeds cleanly under update rules
    val clearedResult = withTimeout(DEFAULT_TIMEOUT_MS) {
      repo.saveSettings(settings.copy(homeTimeZoneId = null))
    }
    assertTrue("Expected clearing homeTimeZoneId to succeed: ${clearedResult.exceptionOrNull()}", clearedResult.isSuccess)
    val reloaded = withTimeout(DEFAULT_TIMEOUT_MS) { repo.getSettings() }
    assertEquals(null, reloaded.getOrNull()?.homeTimeZoneId)
  }

  @Test
  fun upsertWalletAndTransaction_authenticatedOwner_succeeds() = runBlocking {
    signInTestUser(ALICE_EMAIL)
    val repo = FirestoreCloudSyncRepository(firestore, auth)
    val walletId = "wal_${UUID.randomUUID().toString().replace("-", "")}"
    val txId = "tx_${UUID.randomUUID().toString().replace("-", "")}"

    val wallet = CurrencyWallet.create(
      currency = Currency.EUR,
      amount = BigDecimal("350.00"),
      id = walletId
    )
    val tx = WalletTransaction(
      id = txId,
      walletId = walletId,
      type = WalletTransactionType.DEPOSIT,
      amount = Money.of(BigDecimal("350.00"), Currency.EUR),
      note = "Initial deposit"
    )

    assertTrue(withTimeout(DEFAULT_TIMEOUT_MS) { repo.upsertWallet(wallet) }.isSuccess)
    assertTrue(withTimeout(DEFAULT_TIMEOUT_MS) { repo.upsertWalletTransaction(tx) }.isSuccess)

    val wallets = withTimeout(DEFAULT_TIMEOUT_MS) { repo.getWallets() }.getOrThrow()
    assertTrue(wallets.any { it.id == walletId })
  }

  @Test
  fun crossUserRead_aliceDataReadByBob_failsWithPermissionDenied() = runBlocking {
    val aliceUid = signInTestUser(ALICE_EMAIL)
    val aliceRepo = FirestoreCloudSyncRepository(firestore, auth)
    val walletId = "wal_${UUID.randomUUID().toString().replace("-", "")}"
    val wallet = CurrencyWallet.create(Currency.GBP, BigDecimal("120.00"), id = walletId)
    assertTrue(withTimeout(DEFAULT_TIMEOUT_MS) { aliceRepo.upsertWallet(wallet) }.isSuccess)

    signInTestUser(BOB_EMAIL)
    var deniedCode: FirebaseFirestoreException.Code? = null
    try {
      withTimeout(DEFAULT_TIMEOUT_MS) {
        firestore.collection("users").document(aliceUid)
          .collection("wallets").document(walletId).get().await()
      }
    } catch (e: Exception) {
      deniedCode = e.unwrapFirestoreException()?.code
    }
    assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, deniedCode)
  }

  @Test
  fun observeExpenses_unauthenticated_failsWithPermissionDenied() = runBlocking {
    auth.signOut()
    var threwUnauth = false
    try {
      withTimeout(FLOW_TIMEOUT_MS) {
        val repo = FirestoreCloudSyncRepository(firestore, auth)
        repo.observeExpenses().first()
      }
    } catch (e: IllegalStateException) {
      threwUnauth = true
    }
    assertTrue("Expected IllegalStateException when unauthenticated", threwUnauth)

    // Also verify direct Firestore query without auth is rejected by security rules
    var deniedCode: FirebaseFirestoreException.Code? = null
    try {
      withTimeout(DEFAULT_TIMEOUT_MS) {
        firestore.collection("users").document("some_uid").collection("expenses").get().await()
      }
    } catch (e: Exception) {
      deniedCode = e.unwrapFirestoreException()?.code
    }
    assertNotNull(deniedCode)
    assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, deniedCode)
  }

  private companion object {
    const val ALICE_EMAIL = "alice_pluto@test.com"
    const val BOB_EMAIL = "bob_pluto@test.com"
    const val DEFAULT_TIMEOUT_MS = 5000L
    const val FLOW_TIMEOUT_MS = 3000L
  }
}
