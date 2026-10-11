import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../backups/storage/storage.service';
import { CurrencyService } from '../../common/currency/currency.service';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    backup: {
      findMany: jest.fn(),
    },
  };

  const mockStorageService = {
    deleteObjects: jest.fn(),
  };

  const mockCurrencyService = {
    assertSupportedReporting: jest.fn((value: string) => {
      if (!['USD', 'EUR', 'GBP'].includes(value.toUpperCase())) {
        throw new BadRequestException(`Unsupported reporting currency '${value}'`);
      }
      return value.toUpperCase();
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: CurrencyService, useValue: mockCurrencyService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('returns the profile including the persisted base currency', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      id: USER_A,
      email: 'user@example.com',
      name: 'Jane Doe',
      avatarUrl: null,
      baseCurrency: 'USD',
      createdAt: new Date('2026-10-09T03:45:00.000Z'),
    });

    const profile = await service.getProfile(USER_A);

    expect(profile.baseCurrency).toBe('USD');
    expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_A },
        select: expect.objectContaining({ baseCurrency: true }),
      }),
    );
  });

  it('persists a normalized base currency when supplied', async () => {
    mockPrismaService.user.update.mockResolvedValue({
      id: USER_A,
      email: 'user@example.com',
      name: 'Jane Doe',
      avatarUrl: null,
      baseCurrency: 'EUR',
      createdAt: new Date('2026-10-09T03:45:00.000Z'),
    });

    const profile = await service.updateProfile(USER_A, { baseCurrency: 'eur' });

    expect(mockCurrencyService.assertSupportedReporting).toHaveBeenCalledWith('eur');
    expect(mockPrismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ baseCurrency: 'EUR' }),
      }),
    );
    expect(profile.baseCurrency).toBe('EUR');
  });

  it('leaves the base currency untouched when the field is omitted', async () => {
    mockPrismaService.user.update.mockResolvedValue({
      id: USER_A,
      email: 'user@example.com',
      name: 'Jane Doe',
      avatarUrl: null,
      baseCurrency: null,
      createdAt: new Date('2026-10-09T03:45:00.000Z'),
    });

    await service.updateProfile(USER_A, { name: 'Jane' });

    expect(mockPrismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ baseCurrency: expect.anything() }),
      }),
    );
  });

  it('rejects a code the rate provider cannot quote', async () => {
    await expect(service.updateProfile(USER_A, { baseCurrency: 'VND' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrismaService.user.update).not.toHaveBeenCalled();
  });
});
