import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IExchangeRateProvider,
  ProviderRatesResponse,
} from '../interfaces/exchange-rate-provider.interface';

@Injectable()
export class FrankfurterProvider implements IExchangeRateProvider {
  readonly providerName = 'frankfurter';
  private readonly logger = new Logger(FrankfurterProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'EXCHANGE_RATE_BASE_URL',
      'https://api.frankfurter.dev/v1',
    );
  }

  async fetchLatestRates(
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<ProviderRatesResponse> {
    const symbols = targetCurrencies.filter((c) => c !== baseCurrency).join(',');
    const url = `${this.baseUrl}/latest?base=${encodeURIComponent(baseCurrency)}&symbols=${encodeURIComponent(symbols)}`;

    this.logger.log(`Fetching latest exchange rates from ${this.providerName}: ${url}`);

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'PlutoServer/1.0',
          },
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Exchange rate provider HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          amount: number;
          base: string;
          date: string;
          rates: Record<string, number>;
        };

        if (!data || !data.rates || typeof data.rates !== 'object') {
          throw new Error('Malformed provider payload: missing rates dictionary');
        }

        const normalizedRates: Record<string, number> = {
          ...data.rates,
          [baseCurrency]: 1.0, // Ensure base rate equals 1
        };

        return {
          baseCurrency: data.base || baseCurrency,
          effectiveDate: data.date,
          rates: normalizedRates,
          provider: this.providerName,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Exchange rate fetch attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((res) => setTimeout(res, attempt * 1000));
        }
      }
    }

    throw new Error(
      `Failed to fetch exchange rates after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }
}
