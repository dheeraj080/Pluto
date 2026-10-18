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
    // Reset call counts *and* any queued mockImplementationOnce values so a
    // never-consumed "database is down" mock cannot leak into the next test.
    mockPrismaService.$queryRaw.mockReset();
    mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

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

  describe('liveness', () => {
    it('should return 200 without touching the database', () => {
      const result = healthController.getLiveness();

      expect(result.status).toBe('ok');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('should stay 200 while the database is down', () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = healthController.getLiveness();

      expect(result.status).toBe('ok');
    });
  });

  describe('readiness', () => {
    it('should return 200 when the database is reachable', async () => {
      const res = createResponse();
      const result = await healthController.getReadiness(res as never);

      expect(result.status).toBe('ok');
      expect(result.database.status).toBe('connected');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 503 when the database is unreachable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'));

      const res = createResponse();
      const result = await healthController.getReadiness(res as never);

      expect(result.status).toBe('degraded');
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });
});
