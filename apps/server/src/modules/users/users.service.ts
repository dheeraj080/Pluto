import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../backups/storage/storage.service';
import { CurrencyService } from '../../common/currency/currency.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from '../auth/dto/auth-response.dto';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  baseCurrency: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Retrieves profile of currently authenticated user
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
  }

  /**
   * Updates permitted profile fields
   */
  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        // A reporting base must be convertible, not just registry-valid — a
        // preference the provider cannot quote would make every report fail.
        ...(dto.baseCurrency !== undefined
          ? { baseCurrency: this.currencyService.assertSupportedReporting(dto.baseCurrency) }
          : {}),
      },
      select: PROFILE_SELECT,
    });

    return user;
  }

  /**
   * Permanently deletes user account and triggers data retention cascade
   */
  async deleteAccount(userId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Deleting account for user: ${userId}`);

    // Fetch user's backups so corresponding S3 objects can be cleaned up
    const backups = await this.prisma.backup.findMany({
      where: { userId },
      select: { id: true, storageKey: true },
    });

    const storageKeysToDelete = backups.flatMap((b) => [
      b.storageKey,
      `backups/${userId}/staging/${b.id}.bin`,
    ]);

    // Delete S3 objects before removing database record.
    // If object storage is down or fails, this will throw, preserving database records so deletion can be retried.
    if (storageKeysToDelete.length > 0) {
      await this.storageService.deleteObjects(storageKeysToDelete);
    }

    // Delete user from DB (foreign key cascades will remove backups & refresh sessions)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    this.logger.log(`User ${userId} deleted. ${backups.length} backup metadata records cascaded.`);

    return {
      success: true,
      message: 'User account and associated records successfully deleted.',
    };
  }
}
