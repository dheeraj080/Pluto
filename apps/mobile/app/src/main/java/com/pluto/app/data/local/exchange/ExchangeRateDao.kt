package com.pluto.app.data.local.exchange

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ExchangeRateDao {

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertRate(rate: ExchangeRateEntity)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertRates(rates: List<ExchangeRateEntity>)

  @Query(
    """
    SELECT * FROM exchange_rates 
    WHERE fromCurrency = :from AND toCurrency = :to 
    ORDER BY effectiveDate DESC, fetchedAt DESC 
    LIMIT 1
    """
  )
  suspend fun getLatestRate(from: String, to: String): ExchangeRateEntity?

  @Query(
    """
    SELECT * FROM exchange_rates 
    WHERE fromCurrency = :from AND toCurrency = :to 
    ORDER BY effectiveDate DESC, fetchedAt DESC 
    LIMIT 1
    """
  )
  fun observeLatestRate(from: String, to: String): Flow<ExchangeRateEntity?>

  @Query(
    """
    SELECT * FROM exchange_rates 
    WHERE fromCurrency = :from AND toCurrency = :to AND effectiveDate = :date 
    LIMIT 1
    """
  )
  suspend fun getHistoricalRate(from: String, to: String, date: String): ExchangeRateEntity?

  @Query("SELECT * FROM exchange_rates ORDER BY effectiveDate DESC")
  fun observeAllRates(): Flow<List<ExchangeRateEntity>>

  @Query("SELECT * FROM exchange_rates ORDER BY effectiveDate DESC")
  suspend fun getAllRates(): List<ExchangeRateEntity>

  @Query("DELETE FROM exchange_rates")
  suspend fun clearAll()
}
