package com.pluto.app.wallet

import android.content.Context
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class DatabaseMigrationTest {

  @Test
  fun `31 to 36 Version 3 to Version 4 migration succeeds and preserves all data`() {
    runBlocking {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val dbName = "migration_test_db"
    context.deleteDatabase(dbName)

    // Pre-seed UserSettings in SharedPreferences
    val settingsRepo = SharedPreferencesUserSettingsRepository(context)
    val preSettings = UserSettings(homeCurrency = Currency.EUR, isOnboardingCompleted = true)
    settingsRepo.updateSettings(preSettings)

    val factory = FrameworkSQLiteOpenHelperFactory()
    val config = androidx.sqlite.db.SupportSQLiteOpenHelper.Configuration.builder(context)
      .name(dbName)
      .callback(object : androidx.sqlite.db.SupportSQLiteOpenHelper.Callback(3) {
        override fun onCreate(db: SupportSQLiteDatabase) {
          // Schema at Version 3
          db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `exchange_rates` (
              `fromCurrencyCode` TEXT NOT NULL,
              `toCurrencyCode` TEXT NOT NULL,
              `rate` TEXT NOT NULL,
              `timestamp` INTEGER NOT NULL,
              `source` TEXT NOT NULL,
              `isStale` INTEGER NOT NULL,
              PRIMARY KEY(`fromCurrencyCode`, `toCurrencyCode`)
            )
            """.trimIndent()
          )

          db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `expenses` (
              `id` TEXT NOT NULL,
              `originalAmount` TEXT NOT NULL,
              `originalCurrencyCode` TEXT NOT NULL,
              `homeAmount` TEXT NOT NULL,
              `homeCurrencyCode` TEXT NOT NULL,
              `exchangeRate` TEXT NOT NULL,
              `exchangeRateTimestamp` INTEGER NOT NULL,
              `exchangeRateSource` TEXT NOT NULL,
              `categoryId` TEXT NOT NULL,
              `timestamp` INTEGER NOT NULL,
              `merchant` TEXT NOT NULL,
              `note` TEXT NOT NULL,
              `location` TEXT,
              `tripId` TEXT,
              PRIMARY KEY(`id`)
            )
            """.trimIndent()
          )

          db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `wallets` (
              `id` TEXT NOT NULL,
              `currencyCode` TEXT NOT NULL,
              `balance` TEXT NOT NULL,
              `createdAt` INTEGER NOT NULL,
              `updatedAt` INTEGER NOT NULL,
              PRIMARY KEY(`id`)
            )
            """.trimIndent()
          )
          db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_wallets_currencyCode` ON `wallets` (`currencyCode`)")
        }

        override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
      })
      .build()

    val helper = factory.create(config)
    val db = helper.writableDatabase

    // Seed Version 3 data
    db.execSQL("INSERT INTO `wallets` VALUES ('wallet-eur', 'EUR', '1000.00', 1600000000, 1600000000)")
    db.execSQL("INSERT INTO `wallets` VALUES ('wallet-usd', 'USD', '500.50', 1600000000, 1600000000)")
    db.execSQL("INSERT INTO `expenses` VALUES ('exp-1', '25.00', 'EUR', '25.00', 'EUR', '1.0', 1600000000, 'test', 'food', 1600000000, 'Cafe', 'Coffee', NULL, NULL)")
    db.execSQL("INSERT INTO `exchange_rates` VALUES ('EUR', 'USD', '1.08000000', 1600000000, 'ecb', 0)")

    // Execute MIGRATION_3_4
    AppDatabase.MIGRATION_3_4.migrate(db)

    // 32 & 33: Existing wallets survive and balances survive migration unchanged
    val walletCursor = db.query("SELECT id, currencyCode, balance, initialBalance FROM wallets ORDER BY currencyCode ASC")
    assertTrue(walletCursor.moveToNext())
    assertEquals("wallet-eur", walletCursor.getString(0))
    assertEquals("EUR", walletCursor.getString(1))
    assertEquals("1000.00", walletCursor.getString(2))
    assertEquals("1000.00", walletCursor.getString(3)) // initialBalance equals balance

    assertTrue(walletCursor.moveToNext())
    assertEquals("wallet-usd", walletCursor.getString(0))
    assertEquals("USD", walletCursor.getString(1))
    assertEquals("500.50", walletCursor.getString(2))
    assertEquals("500.50", walletCursor.getString(3)) // initialBalance equals balance
    walletCursor.close()

    // 34: Existing expenses survive migration
    val expenseCursor = db.query("SELECT id, originalAmount, merchant FROM expenses WHERE id = 'exp-1'")
    assertTrue(expenseCursor.moveToNext())
    assertEquals("exp-1", expenseCursor.getString(0))
    assertEquals("25.00", expenseCursor.getString(1))
    assertEquals("Cafe", expenseCursor.getString(2))
    expenseCursor.close()

    // 35: Existing exchange rates survive migration
    val rateCursor = db.query("SELECT fromCurrencyCode, toCurrencyCode, rate FROM exchange_rates WHERE fromCurrencyCode = 'EUR'")
    assertTrue(rateCursor.moveToNext())
    assertEquals("EUR", rateCursor.getString(0))
    assertEquals("USD", rateCursor.getString(1))
    assertEquals("1.08000000", rateCursor.getString(2))
    rateCursor.close()

    // 36: Existing settings survive migration
    val postSettings = settingsRepo.getSettings()
    assertEquals(Currency.EUR, postSettings.homeCurrency)
    assertTrue(postSettings.isOnboardingCompleted)

    // Verify wallet_transactions table is created and operational
    db.execSQL("INSERT INTO `wallet_transactions` VALUES ('tx-1', 'wallet-eur', 'DEPOSIT', '200.00', 'EUR', 1600001000, 'Test deposit', NULL, NULL, NULL, NULL, NULL, 1600001000)")
    val txCursor = db.query("SELECT id, walletId, amount, type FROM wallet_transactions WHERE id = 'tx-1'")
    assertTrue(txCursor.moveToNext())
    assertEquals("tx-1", txCursor.getString(0))
    assertEquals("wallet-eur", txCursor.getString(1))
    assertEquals("200.00", txCursor.getString(2))
    assertEquals("DEPOSIT", txCursor.getString(3))
    txCursor.close()

    db.close()
    context.deleteDatabase(dbName)
    }
  }

  @Test
  fun `Version 5 to Version 6 migration adds recurring columns and preserves existing expenses`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val dbName = "migration_5_6_test_db"
    context.deleteDatabase(dbName)

    val factory = FrameworkSQLiteOpenHelperFactory()
    val config = androidx.sqlite.db.SupportSQLiteOpenHelper.Configuration.builder(context)
      .name(dbName)
      .callback(object : androidx.sqlite.db.SupportSQLiteOpenHelper.Callback(5) {
        override fun onCreate(db: SupportSQLiteDatabase) {
          db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `expenses` (
              `id` TEXT NOT NULL,
              `originalAmount` TEXT NOT NULL,
              `originalCurrencyCode` TEXT NOT NULL,
              `homeAmount` TEXT NOT NULL,
              `homeCurrencyCode` TEXT NOT NULL,
              `exchangeRate` TEXT NOT NULL,
              `exchangeRateTimestamp` INTEGER NOT NULL,
              `exchangeRateSource` TEXT NOT NULL,
              `categoryId` TEXT NOT NULL,
              `timestamp` INTEGER NOT NULL,
              `merchant` TEXT NOT NULL,
              `note` TEXT NOT NULL,
              `location` TEXT,
              `tripId` TEXT,
              `receiptUri` TEXT,
              PRIMARY KEY(`id`)
            )
            """.trimIndent()
          )
        }

        override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
      })
      .build()

    val helper = factory.create(config)
    val db = helper.writableDatabase

    db.execSQL("INSERT INTO `expenses` VALUES ('exp-v5', '19.99', 'USD', '19.99', 'USD', '1.0', 1600000000, 'test', 'subscriptions', 1600000000, 'Spotify', 'Monthly sub', NULL, NULL, NULL)")

    AppDatabase.MIGRATION_5_6.migrate(db)

    val cursor = db.query("SELECT id, isRecurring, recurrenceFrequency, lastRecurrenceLoggedMillis FROM expenses WHERE id = 'exp-v5'")
    assertTrue(cursor.moveToNext())
    assertEquals("exp-v5", cursor.getString(0))
    assertEquals(0, cursor.getInt(1)) // default false
    assertTrue(cursor.isNull(2))
    assertTrue(cursor.isNull(3))
    cursor.close()

    db.close()
    context.deleteDatabase(dbName)
  }
}
