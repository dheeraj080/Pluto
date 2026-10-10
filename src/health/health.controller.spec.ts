import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  let healthController: HealthController;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    healthController = moduleRef.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(healthController).toBeDefined();
  });

  it('should return health status ok when database is reachable', async () => {
    const result = await healthController.getHealth();

    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('connected');
    expect(result.environment).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
  });

  it('should return degraded status when database query fails', async () => {
    mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await healthController.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.database.status).toBe('unreachable');
    expect(result.database.error).toBe('Connection timeout');
  });
});
