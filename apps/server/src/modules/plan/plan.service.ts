import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Plan, SubscriptionStatus } from '@prisma/client';

/**
 * Feature entitlements by plan.
 *
 * Features are gated on the user's `plan` field and, where relevant, an active
 * subscription. Free users get the core expense-tracking experience; paid users
 * unlock cloud backups, cross-device sync, and deeper rate history.
 */
export interface PlanFeatures {
  cloudBackups: boolean;
  sync: boolean;
  deepRateHistory: boolean;
}

/** Features available to free users. */
const FREE_FEATURES: PlanFeatures = {
  cloudBackups: false,
  sync: false,
  deepRateHistory: false,
};

/** Features available to paid users. */
const PAID_FEATURES: PlanFeatures = {
  cloudBackups: true,
  sync: true,
  deepRateHistory: true,
};

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the feature flags for a user based on their plan and active
   * subscription.
   */
  async getFeatures(userId: string): Promise<PlanFeatures> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    if (!user) {
      this.logger.warn(`Plan check: user ${userId} not found, treating as free`);
      return FREE_FEATURES;
    }

    if (user.plan !== 'PAID') {
      return FREE_FEATURES;
    }

    // A paid plan only unlocks features while there's an active subscription.
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    if (
      !subscription ||
      !subscription.currentPeriodEnd ||
      subscription.currentPeriodEnd < new Date()
    ) {
      return FREE_FEATURES;
    }

    return PAID_FEATURES;
  }

  /**
   * Returns the user's current plan.
   */
  async getPlan(userId: string): Promise<Plan | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    return user?.plan ?? null;
  }

  /**
   * Throws ForbiddenException if the user is not on a paid plan with an active
   * subscription. Use as a service-level guard inside controllers that already
   * have the userId.
   */
  async requirePaid(userId: string): Promise<void> {
    const features = await this.getFeatures(userId);
    if (!features.cloudBackups || !features.sync) {
      throw new ForbiddenException('Paid plan required for this feature');
    }
  }
}
