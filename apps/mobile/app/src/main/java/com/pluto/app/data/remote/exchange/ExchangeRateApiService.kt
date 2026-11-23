package com.pluto.app.data.remote.exchange

import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Isolated Retrofit service contract for public exchange rate queries.
 * Free, open, no auth key required: open.er-api.com/v6/latest/{base}
 */
interface ExchangeRateApiService {

  @GET("v6/latest/{base}")
  suspend fun getLatestRates(
    @Path("base") baseCurrency: String
  ): ExchangeRateResponseDto
}
