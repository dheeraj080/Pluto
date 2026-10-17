import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  let healthController: HealthController;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const createResponse = () => ({ status: jest.fn().mockReturnThis() });

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

  it('should return health status ok (200) when database is reachable', async () => {
    const res = createResponse();
    const result = await healthController.getHealth(res as never);

    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('connected');
    expect(result.environment).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return degraded status and 503 when database query fails', async () => {
    mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'));

    const res = createResponse();
    const result = await healthController.getHealth(res as never);

    expect(result.status).toBe('degraded');
    expect(result.database.status).toBe('unreachable');
    expect(result.database.error).toBe('Connection timeout');
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
