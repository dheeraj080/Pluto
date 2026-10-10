import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
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
      'Creates or reuses a synthetic account and returns the same token pair as the Google flow, so the UI can be exercised without a Google client ID. Only reachable when ENABLE_DEV_AUTH=true and NODE_ENV != production; otherwise it returns 404.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful (mock session)',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Dev auth is not enabled' })
  async devLogin(@Body() dto: DevLoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.authenticateDevUser(dto.email, dto.name, ipAddress, userAgent);
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
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
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
