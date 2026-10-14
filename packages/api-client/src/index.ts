export { createApiClient, ApiError } from './client';
export type {
  ApiClient,
  ApiClientOptions,
  HttpMethod,
  QueryValue,
  RequestOptions,
} from './client';

export {
  extractErrorMessage,
  isEnvelope,
  unwrapEnvelope,
} from './envelope';
export type { ApiEnvelope, ApiErrorEnvelope } from './envelope';

import type { components } from './schema';

/**
 * Convenience alias for the generated DTO map, e.g.
 * `Schemas['ExpenseDto']`.
 */
export type Schemas = components['schemas'];
