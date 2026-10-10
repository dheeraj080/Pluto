import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Cryptographically secure refresh token previously issued to the client',
    example: 'a4f9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0',
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token must not be empty' })
  refreshToken!: string;
}
