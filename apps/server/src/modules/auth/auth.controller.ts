import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { DevSeedService } from '../dev/dev-seed.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly devSeedService: DevSeedService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with Google ID Token',
    description:
      'Verifies Google ID token from Android client, establishes user session, and returns access & refresh tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired Google ID token' })
  async googleAuth(@Body() dto: GoogleAuthDto, @Req() req: Request): Promise<AuthResponseDto> {
    // `req.ip` honours the `trust proxy` setting, so it cannot be spoofed with a
    // forged X-Forwarded-For header when the app is not actually behind a proxy.
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? '';
    const userAgent = req.headers['user-agent'];
    return this.authService.authenticateWithGoogle(dto.idToken, ipAddress, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mock sign-in for local development (ENABLE_DEV_AUTH only)',
    description:
      'Creates or reuses a synthetic account and returns the same token pair as the Google flow, so the UI can be exercised without a Google client ID. A brand-new account is seeded with sample categories, expenses and budgets so the dashboard and reports have data to show. Only reachable when ENABLE_DEV_AUTH=true and NODE_ENV != production; otherwise it returns 404.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful (mock session)',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Dev auth is not enabled' })
  async devLogin(@Body() dto: DevLoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    // `req.ip` honours the `trust proxy` setting, so it cannot be spoofed with a
    // forged X-Forwarded-For header when the app is not actually behind a proxy.
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? '';
    const userAgent = req.headers['user-agent'];
    const session = await this.authService.authenticateDevUser(
      dto.email,
      dto.name,
      ipAddress,
      userAgent,
    );
    // Idempotent: only an account with no expenses yet gets demo data, so this
    // is a no-op on every sign-in after the first. Best-effort — a seeding
    // hiccup must never block an otherwise-successful dev sign-in.
    try {
      await this.devSeedService.seedDemoData(session.user.id);
    } catch (err) {
      this.logger.warn(
        `Dev demo seeding failed for ${session.user.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return session;
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue new access token',
    description:
      'Validates provided refresh token, invalidates it, issues a new token pair, and guards against token replay.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session rotated successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid, revoked, or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<AuthResponseDto> {
    // `req.ip` honours the `trust proxy` setting, so it cannot be spoofed with a
    // forged X-Forwarded-For header when the app is not actually behind a proxy.
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? '';
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshSession(dto.refreshToken, ipAddress, userAgent);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke active refresh token session',
    description: 'Invalidates the refresh session in the database upon client logout.',
  })
  @ApiResponse({ status: 200, description: 'Session successfully revoked' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ success: boolean; message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { success: true, message: 'Logged out successfully' };
  }
}
