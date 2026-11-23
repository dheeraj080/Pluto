package com.pluto.app.data.remote.exchange

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Remote DTO representing the response from the ExchangeRate API.
 * e.g., open.er-api.com/v6/latest/{base}
 */
@JsonClass(generateAdapter = true)
data class ExchangeRateResponseDto(
  @Json(name = "result") val result: String?,
  @Json(name = "base_code") val baseCode: String,
  @Json(name = "time_last_update_unix") val timeLastUpdateUnix: Long?,
  @Json(name = "time_last_update_utc") val timeLastUpdateUtc: String?,
  @Json(name = "rates") val rates: Map<String, Double>?
)
