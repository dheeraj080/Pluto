package com.pluto.app.data.remote.exchange

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.math.BigDecimal

/**
 * Remote DTO representing the response from the ExchangeRate API.
 * e.g., open.er-api.com/v6/latest/{base}
 */
@JsonClass(generateAdapter = true)
data class ExchangeRateResponseDto(
  @Json(name = "result") val result: String? = null,
  @Json(name = "base_code") val baseCode: String? = null,
  @Json(name = "time_last_update_unix") val timeLastUpdateUnix: Long? = null,
  @Json(name = "time_last_update_utc") val timeLastUpdateUtc: String? = null,
  @Json(name = "rates") val rates: Map<String, BigDecimal>? = null
)
