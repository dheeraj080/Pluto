/**
 * The recurring decision queue's verdict rule.
 *
 * The queue's whole replay contract is knowing whether a failed request was a
 * *timing* problem (unreachable, stale token, transient 5xx — try again next
 * sync) or a *verdict* (a 4xx the server did answer — the decision can never
 * succeed, so the queue retires it). Retiring on the wrong error resurrects a
 * charge the user already answered; retrying on a verdict wedges the queue
 * forever. Both directions are pinned here.
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '@pluto/api-client';

import { recurringActionDisposition } from './recurring-actions';

describe('recurringActionDisposition', () => {
  it('retries when the server was never reached', () => {
    expect(recurringActionDisposition(new ApiError(0, 'Could not reach the server.'))).toBe(
      'retry',
    );
  });

  it('retries while the access token may still rotate', () => {
    expect(recurringActionDisposition(new ApiError(401, 'Unauthorized'))).toBe('retry');
  });

  it('retries on transient server failures', () => {
    expect(recurringActionDisposition(new ApiError(500, 'Internal Server Error'))).toBe('retry');
    expect(recurringActionDisposition(new ApiError(503, 'Service Unavailable'))).toBe('retry');
  });

  it('retries on a failure that produced no HTTP answer at all', () => {
    expect(recurringActionDisposition(new TypeError('fetch failed'))).toBe('retry');
  });

  it('drops a decision the server already handled elsewhere', () => {
    expect(recurringActionDisposition(new ApiError(409, 'This occurrence has already been handled'))).toBe(
      'drop',
    );
  });

  it('drops a decision whose occurrence is gone', () => {
    expect(recurringActionDisposition(new ApiError(404, 'Occurrence not found'))).toBe('drop');
  });

  it('drops a decision the server refused outright', () => {
    expect(recurringActionDisposition(new ApiError(400, 'Bad Request'))).toBe('drop');
    expect(recurringActionDisposition(new ApiError(403, 'Forbidden'))).toBe('drop');
    expect(recurringActionDisposition(new ApiError(422, 'Unprocessable Entity'))).toBe('drop');
  });
});
