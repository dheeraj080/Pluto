import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Length, Matches, Min, MaxLength } from 'class-validator';

export class InitiateBackupDto {
  @ApiProperty({
    description: 'Application backup envelope schema version',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  schemaVersion!: string;

  @ApiProperty({
    description: 'Android application version creating the backup',
    example: '1.2.0',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  appVersion!: string;

  @ApiProperty({
    description: 'Expected total size of the backup file in bytes',
    example: 2048576,
  })
  @IsNumber()
  @Min(1, { message: 'File size must be greater than 0' })
  expectedSizeBytes!: number;

  @ApiProperty({
    description: 'Hex-encoded SHA-256 integrity checksum of the backup file',
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  })
  @IsString()
  @Length(64, 64, { message: 'SHA-256 checksum must be 64 hexadecimal characters' })
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'Checksum must be a valid lowercase or uppercase SHA-256 hex string',
  })
  checksumSha256!: string;
}
