import {
  ContextType,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RatesSyncGuard } from './rates-sync.guard';

/**
 * The external sync trigger is a route that mutates the rate table, so its two
 * failure modes matter more than the happy path: an unconfigured deployment must
 * expose nothing, and a wrong token must be rejected in constant time.
 */
describe('RatesSyncGuard', () => {
  const SECRET = 'sync-token-with-enough-entropy-1234567890';

  function guardWith(token: string | undefined): RatesSyncGuard {
    return new RatesSyncGuard({
      get: jest.fn((key: string, fallback: unknown) =>
        key === 'RATES_SYNC_TOKEN' ? token : fallback,
      ),
    } as unknown as ConfigService);
  }

  function contextWith(headers: Record<string, string | undefined>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
      getType: () => 'http' as ContextType,
    } as unknown as ExecutionContext;
  }

  it('404s when no token is configured, as though the route did not exist', () => {
    const guard = guardWith(undefined);
    expect(() => guard.canActivate(contextWith({ 'x-sync-token': SECRET }))).toThrow(
      NotFoundException,
    );
  });

  it('treats a blank token as unconfigured', () => {
    const guard = guardWith('   ');
    expect(() => guard.canActivate(contextWith({ 'x-sync-token': SECRET }))).toThrow(
      NotFoundException,
    );
  });

  it('accepts the token from the dedicated header', () => {
    const guard = guardWith(SECRET);
    expect(guard.canActivate(contextWith({ 'x-sync-token': SECRET }))).toBe(true);
  });

  it('accepts the token as a bearer credential', () => {
    const guard = guardWith(SECRET);
    expect(guard.canActivate(contextWith({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it('rejects a missing credential', () => {
    const guard = guardWith(SECRET);
    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it('rejects a wrong token of the same length', () => {
    const guard = guardWith(SECRET);
    const wrong = 'x'.repeat(SECRET.length);
    expect(() => guard.canActivate(contextWith({ 'x-sync-token': wrong }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token of a different length without throwing from the comparison', () => {
    const guard = guardWith(SECRET);
    expect(() => guard.canActivate(contextWith({ 'x-sync-token': 'short' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('prefers the dedicated header over a bearer value', () => {
    const guard = guardWith(SECRET);
    expect(
      guard.canActivate(
        contextWith({ 'x-sync-token': SECRET, authorization: 'Bearer wrong-token' }),
      ),
    ).toBe(true);
  });
});
