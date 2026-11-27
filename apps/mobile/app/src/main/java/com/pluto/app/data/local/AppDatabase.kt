package com.pluto.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.expense.ExpenseDao
import com.pluto.app.data.local.expense.ExpenseEntity
import com.pluto.app.data.local.wallet.CurrencyWalletDao
import com.pluto.app.data.local.wallet.CurrencyWalletEntity
import com.pluto.app.data.local.wallet.WalletTransactionDao
import com.pluto.app.data.local.wallet.WalletTransactionEntity

@Database(
  entities = [
    ExchangeRateEntity::class,
    ExpenseEntity::class,
    CurrencyWalletEntity::class,
    WalletTransactionEntity::class
  ],
  version = 9,
  exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

  abstract fun exchangeRateDao(): ExchangeRateDao
  abstract fun expenseDao(): ExpenseDao
  abstract fun currencyWalletDao(): CurrencyWalletDao
  abstract fun walletTransactionDao(): WalletTransactionDao

  companion object {
    @Volatile
    private var INSTANCE: AppDatabase? = null

    /**
     * Migration from Version 1 (Exchange rates only) to Version 2 (Adding Expenses).
     */
    val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(db: SupportSQLiteDatabase) {
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
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_expenses_timestamp` ON `expenses` (`timestamp`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_expenses_categoryId` ON `expenses` (`categoryId`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_expenses_tripId` ON `expenses` (`tripId`)")
      }
    }

    /**
     * Migration from Version 2 (Expenses) to Version 3 (Adding Currency Wallets).
     * Preserves all existing exchange_rates and expenses tables/records.
     */
    val MIGRATION_2_3 = object : Migration(2, 3) {
      override fun migrate(db: SupportSQLiteDatabase) {
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
    }

    /**
     * Migration from Version 3 (Wallets) to Version 4 (Adding Wallet Transactions & Initial Balance).
     * Preserves all existing exchange rates, expenses, and wallets with exact balances intact.
     */
    val MIGRATION_3_4 = object : Migration(3, 4) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `wallets` ADD COLUMN `initialBalance` TEXT NOT NULL DEFAULT '0'")
        db.execSQL("UPDATE `wallets` SET `initialBalance` = `balance`")
        db.execSQL(
          """
          CREATE TABLE IF NOT EXISTS `wallet_transactions` (
            `id` TEXT NOT NULL,
            `walletId` TEXT NOT NULL,
            `type` TEXT NOT NULL,
            `amount` TEXT NOT NULL,
            `currencyCode` TEXT NOT NULL,
            `timestamp` INTEGER NOT NULL,
            `note` TEXT NOT NULL,
            `targetWalletId` TEXT,
            `targetAmount` TEXT,
            `targetCurrencyCode` TEXT,
            `exchangeRate` TEXT,
            `exchangeRateSource` TEXT,
            `createdAt` INTEGER NOT NULL,
            PRIMARY KEY(`id`)
          )
          """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_wallet_transactions_walletId` ON `wallet_transactions` (`walletId`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_wallet_transactions_timestamp` ON `wallet_transactions` (`timestamp`)")
      }
    }

    /**
     * Migration from Version 4 to Version 5 (Adding receiptUri to Expenses).
     */
    val MIGRATION_4_5 = object : Migration(4, 5) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `expenses` ADD COLUMN `receiptUri` TEXT")
      }
    }

    /**
     * Migration from Version 5 to Version 6 (Adding recurring transaction support to Expenses).
     */
    val MIGRATION_5_6 = object : Migration(5, 6) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `expenses` ADD COLUMN `isRecurring` INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE `expenses` ADD COLUMN `recurrenceFrequency` TEXT")
        db.execSQL("ALTER TABLE `expenses` ADD COLUMN `lastRecurrenceLoggedMillis` INTEGER")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_expenses_isRecurring` ON `expenses` (`isRecurring`)")
      }
    }

    /**
     * Migration from Version 6 to Version 7 (Adding createdAt and updatedAt audit timestamps to Expenses).
     * Backfills existing expenses with their transaction timestamp so historical audit records remain intact.
     */
    val MIGRATION_6_7 = object : Migration(6, 7) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `expenses` ADD COLUMN `createdAt` INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE `expenses` ADD COLUMN `updatedAt` INTEGER NOT NULL DEFAULT 0")
        db.execSQL("UPDATE `expenses` SET `createdAt` = `timestamp`, `updatedAt` = `timestamp` WHERE `createdAt` = 0")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_expenses_updatedAt` ON `expenses` (`updatedAt`)")
      }
    }

    /**
     * Migration from Version 7 to Version 8 (Separating Manual Exchange Rates into `manual_exchange_rates`).
     * Creates the dedicated `manual_exchange_rates` table keyed by `(fromCurrency, toCurrency, effectiveFrom)`,
     * migrates every existing `manual*` override row from `exchange_rates` preserving exact BigDecimal rate
     * strings, chains consecutive `expiresAt` bounds so historical periods remain non-overlapping
     * `[effectiveFrom, expiresAt)` windows, and deletes migrated manual rows from `exchange_rates` while
     * keeping all API cache entries intact.
     */
    val MIGRATION_7_8 = object : Migration(7, 8) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
          """
          CREATE TABLE IF NOT EXISTS `manual_exchange_rates` (
            `fromCurrency` TEXT NOT NULL,
            `toCurrency` TEXT NOT NULL,
            `rate` TEXT NOT NULL,
            `effectiveDate` TEXT NOT NULL,
            `effectiveFrom` INTEGER NOT NULL,
            `expiresAt` INTEGER,
            `source` TEXT NOT NULL,
            `updatedAt` INTEGER NOT NULL,
            PRIMARY KEY(`fromCurrency`, `toCurrency`, `effectiveFrom`)
          )
          """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_manual_exchange_rates_fromCurrency_toCurrency_effectiveFrom_expiresAt` ON `manual_exchange_rates` (`fromCurrency`, `toCurrency`, `effectiveFrom`, `expiresAt`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_manual_exchange_rates_effectiveDate` ON `manual_exchange_rates` (`effectiveDate`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_manual_exchange_rates_updatedAt` ON `manual_exchange_rates` (`updatedAt`)")

        db.execSQL(
          """
          INSERT OR REPLACE INTO `manual_exchange_rates` (
            `fromCurrency`,
            `toCurrency`,
            `rate`,
            `effectiveDate`,
            `effectiveFrom`,
            `expiresAt`,
            `source`,
            `updatedAt`
          )
          SELECT
            er.`fromCurrency`,
            er.`toCurrency`,
            er.`rate`,
            er.`effectiveDate`,
            CASE
              WHEN EXISTS (
                SELECT 1 FROM `exchange_rates` dup
                WHERE dup.`fromCurrency` = er.`fromCurrency`
                  AND dup.`toCurrency` = er.`toCurrency`
                  AND dup.`source` LIKE 'manual%'
                  AND dup.`fetchedAt` = er.`fetchedAt`
                  AND dup.`effectiveDate` != er.`effectiveDate`
              )
              THEN COALESCE(CAST(strftime('%s', er.`effectiveDate`) AS INTEGER) * 1000, er.`fetchedAt`)
              ELSE er.`fetchedAt`
            END,
            NULL,
            er.`source`,
            er.`fetchedAt`
          FROM `exchange_rates` er
          WHERE er.`source` LIKE 'manual%'
          ORDER BY er.`effectiveDate` ASC, er.`fetchedAt` ASC
          """.trimIndent()
        )

        // Chain consecutive migrated overrides per currency pair into contiguous non-overlapping
        // half-open intervals [effectiveFrom, expiresAt) so every historical record remains queryable.
        db.execSQL(
          """
          UPDATE `manual_exchange_rates`
          SET `expiresAt` = (
            SELECT MIN(next_m.`effectiveFrom`)
            FROM `manual_exchange_rates` next_m
            WHERE next_m.`fromCurrency` = `manual_exchange_rates`.`fromCurrency`
              AND next_m.`toCurrency` = `manual_exchange_rates`.`toCurrency`
              AND next_m.`effectiveFrom` > `manual_exchange_rates`.`effectiveFrom`
          )
          WHERE EXISTS (
            SELECT 1
            FROM `manual_exchange_rates` next_m
            WHERE next_m.`fromCurrency` = `manual_exchange_rates`.`fromCurrency`
              AND next_m.`toCurrency` = `manual_exchange_rates`.`toCurrency`
              AND next_m.`effectiveFrom` > `manual_exchange_rates`.`effectiveFrom`
          )
          """.trimIndent()
        )

        db.execSQL("DELETE FROM `exchange_rates` WHERE `source` LIKE 'manual%'")
      }
    }

    /**
     * Migration from Version 8 to Version 9 (Removing custom/manual exchange-rate overrides).
     * Drops the dedicated override table and removes any legacy manual rows that may still exist
     * in the market cache. Recorded expense FX snapshots are intentionally untouched.
     */
    val MIGRATION_8_9 = object : Migration(8, 9) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("DROP TABLE IF EXISTS `manual_exchange_rates`")
        db.execSQL("DELETE FROM `exchange_rates` WHERE `source` LIKE 'manual%'")
      }
    }

    fun getInstance(context: Context): AppDatabase {
      return INSTANCE ?: synchronized(this) {
        INSTANCE ?: Room.databaseBuilder(
          context.applicationContext,
          AppDatabase::class.java,
          "global_expense.db"
        )
          .setJournalMode(RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)
          .addMigrations(
            MIGRATION_1_2,
            MIGRATION_2_3,
            MIGRATION_3_4,
            MIGRATION_4_5,
            MIGRATION_5_6,
            MIGRATION_6_7,
            MIGRATION_7_8,
            MIGRATION_8_9
          )
          .build()
          .also { INSTANCE = it }
      }
    }
  }
}
