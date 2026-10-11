import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'https://lh3.googleusercontent.com/a/sample', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({
    description:
      "User's preferred reporting currency (ISO 4217). Null lets the server default apply.",
    example: 'USD',
    nullable: true,
  })
  baseCurrency!: string | null;

  @ApiProperty({ example: '2026-10-09T03:45:00.000Z' })
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT access token for authenticating REST API requests',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Access token expiration time in seconds (e.g. 900 for 15 minutes)',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({
    description: 'Refresh token for rotating session and obtaining new access tokens',
    example: 'd8c9a7b6e5f4c3b2a1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0',
  })
  refreshToken!: string;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}
