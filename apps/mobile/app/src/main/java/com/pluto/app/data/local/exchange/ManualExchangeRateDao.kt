package com.pluto.app.data.local.exchange

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ManualExchangeRateDao {

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertManualRate(rate: ManualExchangeRateEntity)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertManualRates(rates: List<ManualExchangeRateEntity>)

  @Query(
    """
    SELECT * FROM manual_exchange_rates
    WHERE fromCurrency = :from AND toCurrency = :to AND effectiveFrom = :effectiveFrom
    LIMIT 1
    """
  )
  suspend fun getManualRateForPeriod(
    from: String,
    to: String,
    effectiveFrom: Long
  ): ManualExchangeRateEntity?

  @Query(
    """
    SELECT * FROM manual_exchange_rates
    WHERE fromCurrency = :from AND toCurrency = :to
    ORDER BY effectiveFrom ASC
    """
  )
  suspend fun getManualRatesForPair(from: String, to: String): List<ManualExchangeRateEntity>

  @Query(
    """
    SELECT * FROM manual_exchange_rates
    WHERE fromCurrency = :from AND toCurrency = :to
      AND effectiveFrom <= :timestamp
      AND (expiresAt IS NULL OR :timestamp < expiresAt)
    ORDER BY effectiveFrom DESC
    LIMIT 1
    """
  )
  suspend fun getApplicableManualRate(
    from: String,
    to: String,
    timestamp: Long
  ): ManualExchangeRateEntity?

  @Query(
    """
    SELECT * FROM manual_exchange_rates
    WHERE fromCurrency = :from AND toCurrency = :to
    ORDER BY effectiveFrom DESC
    """
  )
  fun observeManualRatesForPair(from: String, to: String): Flow<List<ManualExchangeRateEntity>>

  @Query("SELECT * FROM manual_exchange_rates ORDER BY fromCurrency ASC, toCurrency ASC, effectiveFrom ASC")
  fun observeAllManualRates(): Flow<List<ManualExchangeRateEntity>>

  @Query("SELECT * FROM manual_exchange_rates ORDER BY fromCurrency ASC, toCurrency ASC, effectiveFrom ASC")
  suspend fun getAllManualRates(): List<ManualExchangeRateEntity>

  @Query("DELETE FROM manual_exchange_rates WHERE fromCurrency = :from AND toCurrency = :to AND effectiveFrom = :effectiveFrom")
  suspend fun deleteManualRatePeriod(from: String, to: String, effectiveFrom: Long)

  @Query("DELETE FROM manual_exchange_rates WHERE fromCurrency = :from AND toCurrency = :to")
  suspend fun deleteManualRatesForPair(from: String, to: String)

  @Query("DELETE FROM manual_exchange_rates")
  suspend fun clearAll()
}
