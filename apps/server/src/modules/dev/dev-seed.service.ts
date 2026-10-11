import { Injectable, Logger } from '@nestjs/common';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyConverterService } from '../expenses/currency-converter.service';
import { DEFAULT_CATEGORIES } from '../expenses/expense-defaults';

/** Currencies the demo account prefers, filtered to those the snapshot knows. */
const DEMO_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'SGD',
  'NZD',
  'CNY',
  'INR',
];

const PAYMENT_METHODS = ['Card', 'Cash', 'Bank transfer', 'Mobile pay'];

/** How many trailing months of history to fabricate (including the current one). */
const DEMO_MONTHS = 6;

interface Sample {
  descriptions: string[];
  min: number;
  max: number;
}

const SAMPLES: Record<string, Sample> = {
  'Food & Dining': {
    descriptions: ['Weekly groceries', 'Coffee', 'Lunch', 'Dinner out', 'Farmers market'],
    min: 4,
    max: 70,
  },
  Transport: {
    descriptions: ['Metro pass', 'Fuel', 'Taxi', 'Train ticket', 'Parking'],
    min: 2,
    max: 45,
  },
  Shopping: {
    descriptions: ['Sneakers', 'Headphones', 'Home supplies', 'Gift', 'Bookstore'],
    min: 10,
    max: 220,
  },
  'Bills & Utilities': {
    descriptions: ['Electricity', 'Internet', 'Mobile plan', 'Water', 'Renters insurance'],
    min: 20,
    max: 160,
  },
  Entertainment: {
    descriptions: ['Cinema', 'Streaming', 'Concert', 'Games', 'Night out'],
    min: 5,
    max: 90,
  },
  Health: {
    descriptions: ['Pharmacy', 'Gym membership', 'Doctor visit', 'Vitamins', 'Dentist'],
    min: 8,
    max: 140,
  },
  Other: {
    descriptions: ['Misc', 'Donation', 'Kids activities', 'Pet supplies', 'Repair'],
    min: 5,
    max: 110,
  },
};

const FALLBACK_SAMPLE: Sample = { descriptions: ['Expense'], min: 5, max: 100 };

/** Deterministic PRNG (mulberry32) so a given account always looks the same. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Populates a freshly-created dev account with plausible expenses and budgets
 * so the dashboard and reports have something to render.
 *
 * Only ever invoked from the dev mock sign-in (`POST /v1/auth/dev-login`),
 * which is itself refused unless `ENABLE_DEV_AUTH=true` and the process is not
 * running in production. Seeding is idempotent: an account that already has an
 * expense is left untouched, so calling it on every sign-in is safe.
 */
@Injectable()
export class DevSeedService {
  private readonly logger = new Logger(DevSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConverter: CurrencyConverterService,
  ) {}

  async seedDemoData(userId: string): Promise<void> {
    const existing = await this.prisma.expense.count({ where: { userId } });
    if (existing > 0) return;

    const categories = await this.ensureCategories(userId);
    if (categories.length === 0) return;

    const currencies = await this.resolveCurrencies();
    const baseCurrency = this.currencyConverter.defaultBaseCurrency;
    const random = mulberry32(hashString(userId));

    const expenses = this.buildExpenses(userId, categories, currencies, random);
    if (expenses.length > 0) {
      await this.prisma.expense.createMany({ data: expenses });
    }

    const budgets = this.buildBudgets(userId, categories, baseCurrency);
    if (budgets.length > 0) {
      await this.prisma.budget.createMany({ data: budgets });
    }

    this.logger.log(
      `Seeded demo account ${userId} with ${expenses.length} expenses and ${budgets.length} budgets`,
    );
  }

  /** Reuses existing categories, otherwise creates the default set. */
  private async ensureCategories(userId: string) {
    const existing = await this.prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    });
    if (existing.length > 0) return existing;

    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })),
      skipDuplicates: true,
    });

    return this.prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    });
  }

  /**
   * Only seed currencies the current rate snapshot can convert. Reports convert
   * every seeded currency inline, so inventing one the snapshot lacks would turn
   * a demo dashboard into a 400/500 — the exact opposite of the intent.
   */
  private async resolveCurrencies(): Promise<string[]> {
    const baseCurrency = this.currencyConverter.defaultBaseCurrency;
    try {
      const converter = await this.currencyConverter.tryGetConverter();
      if (converter) {
        const known = converter.supportedCurrencies;
        const usable = DEMO_CURRENCIES.filter((currency) => known.includes(currency));
        if (usable.length > 0) return usable;
      }
    } catch {
      /* fall through to the base currency only */
    }
    return [baseCurrency];
  }

  private buildExpenses(
    userId: string,
    categories: Array<{ id: string; name: string }>,
    currencies: string[],
    random: () => number,
  ): Prisma.ExpenseCreateManyInput[] {
    const now = new Date();
    const todayDay = now.getUTCDate();
    const rows: Prisma.ExpenseCreateManyInput[] = [];

    for (let monthOffset = DEMO_MONTHS - 1; monthOffset >= 0; monthOffset--) {
      const monthDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, 1),
      );
      const year = monthDate.getUTCFullYear();
      const monthIndex = monthDate.getUTCMonth();
      const maxDay = monthOffset === 0 ? todayDay : lastDayOfMonth(year, monthIndex);

      const count = 10 + Math.floor(random() * 12);
      for (let i = 0; i < count; i++) {
        const category = categories[Math.floor(random() * categories.length)];
        const sample = SAMPLES[category.name] ?? FALLBACK_SAMPLE;
        const currency = currencies[Math.floor(random() * currencies.length)];
        const day = 1 + Math.floor(random() * maxDay);
        const amount = sample.min + random() * (sample.max - sample.min);

        rows.push({
          userId,
          categoryId: category.id,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          currency,
          description:
            sample.descriptions[Math.floor(random() * sample.descriptions.length)] ?? null,
          incurredOn: new Date(Date.UTC(year, monthIndex, day)),
          paymentMethod: PAYMENT_METHODS[Math.floor(random() * PAYMENT_METHODS.length)],
        });
      }
    }

    return rows;
  }

  private buildBudgets(
    userId: string,
    categories: Array<{ id: string; name: string }>,
    baseCurrency: string,
  ): Prisma.BudgetCreateManyInput[] {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const food = categories.find((category) => category.name === 'Food & Dining');

    const budgets: Prisma.BudgetCreateManyInput[] = [
      {
        userId,
        categoryId: null,
        amount: new Prisma.Decimal('2000.00'),
        currency: baseCurrency,
        period: BudgetPeriod.MONTHLY,
        startDate: startOfMonth,
      },
    ];

    if (food) {
      budgets.push({
        userId,
        categoryId: food.id,
        amount: new Prisma.Decimal('400.00'),
        currency: baseCurrency,
        period: BudgetPeriod.MONTHLY,
        startDate: startOfMonth,
      });
    }

    return budgets;
  }
}
