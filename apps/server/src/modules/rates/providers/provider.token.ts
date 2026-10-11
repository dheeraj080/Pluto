/**
 * Injection token for the active exchange-rate provider implementation.
 *
 * The concrete implementation is chosen by `EXCHANGE_RATE_PROVIDER` in the
 * provider factory inside rates.module.ts, so services depend on the
 * `IExchangeRateProvider` contract rather than on a specific vendor.
 */
export const EXCHANGE_RATE_PROVIDER = Symbol('EXCHANGE_RATE_PROVIDER');
