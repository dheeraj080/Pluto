import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyConverterService } from './currency-converter.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';
import {
  BudgetDto,
  ExpenseCategoryDto,
  ExpenseDto,
  PaginatedExpensesResponseDto,
} from './dto/expense-response.dto';
import { formatDate, toUtcDate } from './expenses.utils';
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_COLOR } from './expense-defaults';

const CATEGORY_SELECT = { name: true, color: true } as const;

type ExpenseWithCategory = Prisma.ExpenseGetPayload<{
  include: { category: { select: typeof CATEGORY_SELECT } };
}>;

type CategoryWithCount = Prisma.ExpenseCategoryGetPayload<{
  include: { _count: { select: { expenses: true } } };
}>;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConverter: CurrencyConverterService,
  ) {}

  // ---------------------------------------------------------------- categories

  async listCategories(userId: string): Promise<ExpenseCategoryDto[]> {
    let categories = await this.readCategories(userId);

    // Lazily seed so the first visit has something to file expenses against.
    if (categories.length === 0) {
      await this.seedDefaultCategories(userId);
      categories = await this.readCategories(userId);
    }

    return categories.map((c) => this.toCategoryDto(c));
  }

  async createCategory(userId: string, dto: CreateCategoryDto): Promise<ExpenseCategoryDto> {
    const name = dto.name.trim();
    await this.assertCategoryNameFree(userId, name);

    const created = await this.prisma.expenseCategory.create({
      data: {
        userId,
        name,
        color: dto.color ?? DEFAULT_CATEGORY_COLOR,
        icon: dto.icon,
        isDefault: false,
        sortOrder: 0,
      },
      include: { _count: { select: { expenses: true } } },
    });

    return this.toCategoryDto(created);
  }

  async updateCategory(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<ExpenseCategoryDto> {
    const existing = await this.findOwnedCategory(userId, id);

    if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      await this.assertCategoryNameFree(userId, dto.name.trim());
    }

    const updated = await this.prisma.expenseCategory.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { _count: { select: { expenses: true } } },
    });

    return this.toCategoryDto(updated);
  }

  async deleteCategory(
    userId: string,
    id: string,
    reassignTo?: string,
  ): Promise<{ success: boolean; message: string }> {
    const category = await this.findOwnedCategory(userId, id);

    const inUse = await this.prisma.expense.count({ where: { categoryId: category.id } });
    if (inUse > 0) {
      if (!reassignTo) {
        throw new ConflictException(
          `Cannot delete '${category.name}': ${inUse} expense${inUse === 1 ? '' : 's'} still ${inUse === 1 ? 'uses' : 'use'} it. Reassign them first.`,
        );
      }
      if (reassignTo === id) {
        throw new ConflictException('Cannot reassign expenses to the category being deleted.');
      }
      const target = await this.findOwnedCategory(userId, reassignTo, 'Target category not found');
      await this.prisma.$transaction([
        this.prisma.expense.updateMany({
          where: { userId, categoryId: category.id },
          data: { categoryId: target.id },
        }),
        this.prisma.budget.deleteMany({ where: { userId, categoryId: category.id } }),
        this.prisma.expenseCategory.delete({ where: { id: category.id } }),
      ]);
      return { success: true, message: 'Category deleted and expenses reassigned successfully' };
    }

    await this.prisma.budget.deleteMany({ where: { userId, categoryId: category.id } });
    await this.prisma.expenseCategory.delete({ where: { id: category.id } });

    return { success: true, message: 'Category deleted successfully' };
  }

  // ------------------------------------------------------------------ expenses

  async createExpense(userId: string, dto: CreateExpenseDto): Promise<ExpenseDto> {
    const category = await this.findOwnedCategory(userId, dto.categoryId, 'Category not found');
    const currency = this.currencyConverter.assertValidCode(dto.currency);

    const created = await this.prisma.expense.create({
      data: {
        userId,
        categoryId: category.id,
        amount: new Prisma.Decimal(dto.amount.toFixed(2)),
        currency,
        description: dto.description,
        paymentMethod: dto.paymentMethod,
        incurredOn: toUtcDate(dto.incurredOn),
      },
      include: { category: { select: CATEGORY_SELECT } },
    });

    return this.toExpenseDto(created);
  }

  async listExpenses(
    userId: string,
    query: ExpenseQueryDto,
  ): Promise<PaginatedExpensesResponseDto> {
    const where = this.buildExpenseFilter(userId, query);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: this.buildOrderBy(query.sort),
        skip,
        take: limit,
        include: { category: { select: CATEGORY_SELECT } },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items: items.map((e) => this.toExpenseDto(e)),
      page,
      limit,
      total,
    };
  }

  async getExpense(userId: string, id: string): Promise<ExpenseDto> {
    const expense = await this.findOwnedExpense(userId, id);
    return this.toExpenseDto(expense);
  }

  async updateExpense(userId: string, id: string, dto: UpdateExpenseDto): Promise<ExpenseDto> {
    const expense = await this.findOwnedExpense(userId, id);

    let categoryId = expense.categoryId;
    if (dto.categoryId !== undefined && dto.categoryId !== expense.categoryId) {
      const category = await this.findOwnedCategory(userId, dto.categoryId, 'Category not found');
      categoryId = category.id;
    }

    const currency =
      dto.currency !== undefined
        ? this.currencyConverter.assertValidCode(dto.currency)
        : expense.currency;

    const updated = await this.prisma.expense.update({
      where: { id: expense.id },
      data: {
        categoryId,
        currency,
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount.toFixed(2)) } : {}),
        ...(dto.incurredOn !== undefined ? { incurredOn: toUtcDate(dto.incurredOn) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
      },
      include: { category: { select: CATEGORY_SELECT } },
    });

    return this.toExpenseDto(updated);
  }

  async deleteExpense(userId: string, id: string): Promise<{ success: boolean; message: string }> {
    const expense = await this.findOwnedExpense(userId, id);
    await this.prisma.expense.delete({ where: { id: expense.id } });
    return { success: true, message: 'Expense deleted successfully' };
  }

  // -------------------------------------------------------------------- budgets

  async listBudgets(userId: string): Promise<BudgetDto[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
      include: { category: { select: { name: true } } },
    });

    return budgets.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? null,
      amount: Number(b.amount),
      currency: b.currency,
      period: b.period,
      startDate: formatDate(b.startDate),
      createdAt: b.createdAt,
    }));
  }

  async createBudget(userId: string, dto: CreateBudgetDto): Promise<BudgetDto> {
    const period = dto.period ?? BudgetPeriod.MONTHLY;
    const categoryId = dto.categoryId ?? null;
    const currency = this.currencyConverter.assertValidCode(dto.currency);

    if (categoryId) {
      await this.findOwnedCategory(userId, categoryId, 'Category not found');
    }

    const duplicate = await this.prisma.budget.findFirst({
      where: { userId, categoryId, period },
      include: { category: { select: { name: true } } },
    });
    if (duplicate) {
      throw new ConflictException(
        `A ${period.toLowerCase()} budget for ${duplicate.category?.name ?? 'all expenses'} already exists`,
      );
    }

    const created = await this.prisma.budget.create({
      data: {
        userId,
        categoryId,
        amount: new Prisma.Decimal(dto.amount.toFixed(2)),
        currency,
        period,
        startDate: toUtcDate(dto.startDate ?? formatDate(new Date())),
      },
      include: { category: { select: { name: true } } },
    });

    return this.toBudgetDto(created);
  }

  async updateBudget(userId: string, id: string, dto: UpdateBudgetDto): Promise<BudgetDto> {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget not found');

    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: {
        amount: new Prisma.Decimal(dto.amount.toFixed(2)),
        ...(dto.startDate !== undefined ? { startDate: toUtcDate(dto.startDate) } : {}),
      },
      include: { category: { select: { name: true } } },
    });

    return this.toBudgetDto(updated);
  }

  async deleteBudget(userId: string, id: string): Promise<{ success: boolean; message: string }> {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget not found');

    await this.prisma.budget.delete({ where: { id: budget.id } });
    return { success: true, message: 'Budget deleted successfully' };
  }

  // -------------------------------------------------------------------- helpers

  /**
   * Builds a `where` clause scoped to the caller.
   *
   * Every filter is optional; `userId` is always present so cross-account reads
   * are structurally impossible rather than merely guarded.
   */
  private buildExpenseFilter(userId: string, query: ExpenseQueryDto): Prisma.ExpenseWhereInput {
    const where: Prisma.ExpenseWhereInput = { userId };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.currency) where.currency = query.currency.toUpperCase();
    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    if (query.from || query.to) {
      where.incurredOn = {
        ...(query.from ? { gte: toUtcDate(query.from) } : {}),
        ...(query.to ? { lte: toUtcDate(query.to) } : {}),
      };
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amount = {
        ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
        ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
      };
    }

    return where;
  }

  private buildOrderBy(sort: ExpenseQueryDto['sort']): Prisma.ExpenseOrderByWithRelationInput[] {
    switch (sort) {
      case 'amount_asc':
        return [{ amount: 'asc' }, { id: 'asc' }];
      case 'amount_desc':
        return [{ amount: 'desc' }, { id: 'asc' }];
      case 'date_asc':
        return [{ incurredOn: 'asc' }, { createdAt: 'asc' }];
      default:
        return [{ incurredOn: 'desc' }, { createdAt: 'desc' }];
    }
  }

  private async readCategories(userId: string): Promise<CategoryWithCount[]> {
    return this.prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { expenses: true } } },
    });
  }

  private async seedDefaultCategories(userId: string): Promise<void> {
    await this.prisma.$transaction(
      DEFAULT_CATEGORIES.map((category) =>
        this.prisma.expenseCategory.create({
          data: { ...category, userId },
          select: { id: true },
        }),
      ),
    );
  }

  private async findOwnedCategory(
    userId: string,
    id: string,
    message = 'Category not found',
  ): Promise<CategoryWithCount> {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, userId },
      include: { _count: { select: { expenses: true } } },
    });
    if (!category) throw new NotFoundException(message);
    return category;
  }

  private async findOwnedExpense(userId: string, id: string): Promise<ExpenseWithCategory> {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
      include: { category: { select: CATEGORY_SELECT } },
    });
    // 404 (not 403) so a foreign id is indistinguishable from a missing one.
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  private async assertCategoryNameFree(userId: string, name: string): Promise<void> {
    const clash = await this.prisma.expenseCategory.findFirst({ where: { userId, name } });
    if (clash) {
      throw new ConflictException(`A category named '${name}' already exists`);
    }
  }

  private toCategoryDto(category: CategoryWithCount): ExpenseCategoryDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      isDefault: category.isDefault,
      sortOrder: category.sortOrder,
      expenseCount: category._count.expenses,
    };
  }

  private toExpenseDto(expense: ExpenseWithCategory): ExpenseDto {
    return {
      id: expense.id,
      categoryId: expense.categoryId,
      categoryName: expense.category.name,
      categoryColor: expense.category.color,
      amount: Number(expense.amount),
      currency: expense.currency,
      description: expense.description,
      incurredOn: formatDate(expense.incurredOn),
      paymentMethod: expense.paymentMethod,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }

  private toBudgetDto(budget: {
    id: string;
    categoryId: string | null;
    category?: { name: string } | null;
    amount: Prisma.Decimal;
    currency: string;
    period: BudgetPeriod;
    startDate: Date;
    createdAt: Date;
  }): BudgetDto {
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category?.name ?? null,
      amount: Number(budget.amount),
      currency: budget.currency,
      period: budget.period,
      startDate: formatDate(budget.startDate),
      createdAt: budget.createdAt,
    };
  }
}
