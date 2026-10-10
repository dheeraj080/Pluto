import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared account used when `dev-login` is called without an e-mail. */
export const DEFAULT_DEV_EMAIL = 'dev@pluto.local';

/**
 * Dev-only mock sign-in payload.
 *
 * Both fields are optional: omitting the e-mail signs in as the shared
 * `dev@pluto.local` account, which keeps test data stable across sessions.
 */
export class DevLoginDto {
  @ApiPropertyOptional({
    description: `Account to sign in as. Defaults to ${DEFAULT_DEV_EMAIL}.`,
    example: DEFAULT_DEV_EMAIL,
  })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid e-mail address' })
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Dev User', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
