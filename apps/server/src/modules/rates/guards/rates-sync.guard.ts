import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Guards the operator-only `POST /rates/sync` trigger.
 *
 * The daily exchange-rate sync normally runs from an in-process cron, but a
 * platform that spins an idle instance down runs no crons at all. This route is
 * the external trigger for exactly that case (a scheduled GitHub Actions job,
 * an uptime monitor, any scheduler that can send a header).
 *
 * Two deliberate properties:
 *
 * - **Unconfigured means absent.** With no `RATES_SYNC_TOKEN` the route 404s,
 *   so a deployment that has not opted in does not advertise an endpoint that
 *   mutates the rate table. A 404 is also indistinguishable from a missing
 *   route, so it gives an unauthenticated caller nothing to probe.
 * - **Fail closed, compare in constant time.** A missing or wrong token is 401;
 *   `timingSafeEqual` keeps the comparison from leaking the secret's length or
 *   prefix through response timing.
 */
@Injectable()
export class RatesSyncGuard implements CanActivate {
  private readonly logger = new Logger(RatesSyncGuard.name);
  private readonly token: string;

  constructor(private readonly configService: ConfigService) {
    this.token = (this.configService.get<string>('RATES_SYNC_TOKEN') || '').trim();
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.token.length === 0) {
      // Not configured: behave exactly like a route that does not exist.
      throw new NotFoundException('Cannot POST /rates/sync');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = this.readToken(request);

    if (!provided || !this.matches(provided)) {
      throw new UnauthorizedException('Invalid sync token');
    }

    return true;
  }

  /**
   * Accepts the token from a dedicated header, falling back to a bearer
   * credential so a caller can use either convention without the secret ever
   * appearing in a URL (and therefore in access logs).
   */
  private readToken(request: Request): string {
    const header = request.headers['x-sync-token'];
    if (typeof header === 'string' && header.length > 0) return header.trim();

    const authorization = request.headers.authorization;
    if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
      return authorization.slice(7).trim();
    }

    return '';
  }

  private matches(provided: string): boolean {
    const expected = Buffer.from(this.token, 'utf8');
    const actual = Buffer.from(provided, 'utf8');

    // timingSafeEqual throws on unequal lengths, so compare a hash-free length
    // check first. The lengths are not secret (the header length is observable
    // anyway); the comparison of equal-length values is what must not leak.
    if (expected.length !== actual.length) {
      this.logger.warn('Rejected a rates sync trigger with a token of the wrong length');
      return false;
    }

    return timingSafeEqual(expected, actual);
  }
}
