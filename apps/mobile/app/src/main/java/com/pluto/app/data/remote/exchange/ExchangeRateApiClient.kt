package com.pluto.app.data.remote.exchange

import com.pluto.app.BuildConfig
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.math.BigDecimal
import java.util.concurrent.TimeUnit

object ExchangeRateApiClient {

  private const val BASE_URL = "https://open.er-api.com/"

  internal val moshi: Moshi by lazy {
    Moshi.Builder()
      .add(BigDecimal::class.java, BigDecimalJsonAdapter)
      .add(KotlinJsonAdapterFactory())
      .build()
  }

  internal val responseAdapter: JsonAdapter<ExchangeRateResponseDto> by lazy {
    moshi.adapter(ExchangeRateResponseDto::class.java)
  }

  internal fun parseResponse(json: String): ExchangeRateResponseDto {
    return responseAdapter.fromJson(json)
      ?: throw JsonDataException("Exchange rate API response JSON evaluated to null")
  }

  private val okHttpClient: OkHttpClient by lazy {
    OkHttpClient.Builder()
      .apply {
        if (BuildConfig.DEBUG) {
          addInterceptor(
            HttpLoggingInterceptor().apply {
              level = HttpLoggingInterceptor.Level.BASIC
            }
          )
        }
      }
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(15, TimeUnit.SECONDS)
      .build()
  }

  val apiService: ExchangeRateApiService by lazy {
    Retrofit.Builder()
      .baseUrl(BASE_URL)
      .client(okHttpClient)
      .addConverterFactory(MoshiConverterFactory.create(moshi))
      .build()
      .create(ExchangeRateApiService::class.java)
  }
}

/**
 * Moshi [JsonAdapter] that parses JSON numeric tokens directly into [BigDecimal] via their raw
 * string representation, avoiding any intermediate [Double] or [Float] conversion and preserving
 * the exact decimal precision returned by the API.
 */
internal object BigDecimalJsonAdapter : JsonAdapter<BigDecimal>() {

  override fun fromJson(reader: JsonReader): BigDecimal {
    return when (val token = reader.peek()) {
      JsonReader.Token.NUMBER,
      JsonReader.Token.STRING -> {
        val raw = reader.nextString().trim()
        if (raw.isEmpty()) {
          throw JsonDataException("Blank BigDecimal value at ${reader.path}")
        }
        try {
          BigDecimal(raw)
        } catch (e: NumberFormatException) {
          throw JsonDataException("Malformed BigDecimal value '$raw' at ${reader.path}", e)
        }
      }
      JsonReader.Token.NULL -> {
        reader.nextNull<Unit>()
        throw JsonDataException("Unexpected null BigDecimal value at ${reader.path}")
      }
      else -> {
        throw JsonDataException(
          "Expected numeric JSON token for BigDecimal but was $token at ${reader.path}"
        )
      }
    }
  }

  override fun toJson(writer: JsonWriter, value: BigDecimal?) {
    if (value == null) {
      writer.nullValue()
    } else {
      writer.value(value)
    }
  }
}
