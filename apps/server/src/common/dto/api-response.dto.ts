import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ example: true, description: 'Indicates if the request was successful' })
  success!: boolean;

  @ApiProperty({
    example: 'Operation successful',
    description: 'Response message',
    required: false,
  })
  message?: string;

  @ApiProperty({ description: 'Response payload data', required: false })
  data?: T;

  @ApiProperty({
    example: '2026-10-09T03:45:00.000Z',
    description: 'ISO timestamp of the response',
  })
  timestamp!: string;
}
