import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Raw Google ID Token (JWT) obtained from Google Sign-In SDK on the Android client',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Google ID token must not be empty' })
  idToken!: string;
}
