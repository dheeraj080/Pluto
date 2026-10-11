import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { ExpensesReportsService } from './expenses-reports.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
  BudgetStatusQueryDto,
  ByDayOfWeekQueryDto,
  ComparisonQueryDto,
  ExpenseQueryDto,
  ReportQueryDto,
  TopQueryDto,
  TrendQueryDto,
} from './dto/expense-query.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';
import {
  BudgetDto,
  ExpenseCategoryDto,
  ExpenseDto,
  PaginatedExpensesResponseDto,
} from './dto/expense-response.dto';
import {
  BudgetStatusResponseDto,
  ExpenseSummaryDto,
  ExpenseTrendDto,
} from './dto/report-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

type Ack = { success: boolean; message: string };

/**
 * Static segments are declared before `:id` so Nest resolves them first;
 * route order in this class is load-bearing.
 */
@ApiTags('Expenses')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly reportsService: ExpensesReportsService,
  ) {}

  // --------------------------------------------------------------- categories

  @Get('categories')
  @ApiOperation({
    summary: 'List expense categories',
    description:
      "Returns the caller's categories ordered by sort order. Seeds a default set on first call for a new account.",
  })
  @ApiResponse({
    status: 200,
    description: 'Categories, including per-category expense counts',
    type: [ExpenseCategoryDto],
  })
  async listCategories(@CurrentUser() user: AuthenticatedUser): Promise<ExpenseCategoryDto[]> {
    return this.expensesService.listCategories(user.id);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an expense category' })
  @ApiResponse({ status: 201, description: 'Category created', type: ExpenseCategoryDto })
  @ApiResponse({ status: 409, description: 'A category with that name already exists' })
  async createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<ExpenseCategoryDto> {
    return this.expensesService.createCategory(user.id, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update an expense category' })
  @ApiResponse({ status: 200, description: 'Category updated', type: ExpenseCategoryDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<ExpenseCategoryDto> {
    return this.expensesService.updateCategory(user.id, id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an expense category' })
  @ApiResponse({ status: 200, description: 'Category deleted', type: Object })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category still has expenses assigned to it' })
  async deleteCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Ack> {
    return this.expensesService.deleteCategory(user.id, id);
  }

  // ------------------------------------------------------------------ reports

  @Get('summary')
  @ApiOperation({
    summary: 'Summarise spending over a date range',
    description:
      'Returns the period total, average, a per-category breakdown and native per-currency subtotals. Totals are converted into the requested base currency; when no rate snapshot is available `converted` is false and the base-currency figures are null.',
  })
  @ApiResponse({ status: 200, description: 'Period summary', type: ExpenseSummaryDto })
  @ApiResponse({ status: 400, description: 'Unsupported base currency or malformed date' })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportQueryDto,
  ): Promise<ExpenseSummaryDto> {
    return this.reportsService.getSummary(user.id, query);
  }

  @Get('trends')
  @ApiOperation({
    summary: 'Monthly spending totals for charts',
    description:
      'Returns a continuous series of trailing months, oldest first, including empty months.',
  })
  @ApiResponse({ status: 200, description: 'Monthly totals', type: ExpenseTrendDto })
  @ApiResponse({ status: 400, description: 'Unsupported base currency' })
  async getTrends(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TrendQueryDto,
  ): Promise<ExpenseTrendDto> {
    return this.reportsService.getTrends(user.id, query);
  }

  // ------------------------------------------------------------------ budgets

  @Get('budgets')
  @ApiOperation({ summary: 'List configured budgets' })
  @ApiResponse({ status: 200, description: 'Budgets owned by the caller', type: [BudgetDto] })
  async listBudgets(@CurrentUser() user: AuthenticatedUser): Promise<BudgetDto[]> {
    return this.expensesService.listBudgets(user.id);
  }

  @Post('budgets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a budget',
    description:
      'Omit `categoryId` to create an overall budget. Only one budget per (category, period) pair is allowed.',
  })
  @ApiResponse({ status: 201, description: 'Budget created', type: BudgetDto })
  @ApiResponse({ status: 409, description: 'A matching budget already exists' })
  async createBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBudgetDto,
  ): Promise<BudgetDto> {
    return this.expensesService.createBudget(user.id, dto);
  }

  @Get('budgets/status')
  @ApiOperation({
    summary: 'Compare budgets against actual spending',
    description:
      'Evaluates every budget against the requested month, converting spend into the base currency.',
  })
  @ApiResponse({ status: 200, description: 'Budget vs actual', type: BudgetStatusResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed month or unsupported base currency' })
  async getBudgetStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BudgetStatusQueryDto,
  ): Promise<BudgetStatusResponseDto> {
    return this.reportsService.getBudgetStatus(user.id, query);
  }

  @Get('comparison')
  @ApiOperation({
    summary: 'Compare spending between two periods',
    description:
      'Compares current period against previous period with absolute and percentage deltas.',
  })
  @ApiResponse({ status: 200, description: 'Period comparison' })
  @ApiResponse({ status: 400, description: 'Malformed date or unsupported base currency' })
  async getComparison(@CurrentUser() user: AuthenticatedUser, @Query() query: ComparisonQueryDto) {
    return this.reportsService.getComparison(user.id, query);
  }

  @Get('top')
  @ApiOperation({
    summary: 'Top N expenses by amount',
    description: 'Returns largest expenses in the period, optionally converted to base currency.',
  })
  @ApiResponse({ status: 200, description: 'Top expenses' })
  @ApiResponse({ status: 400, description: 'Invalid query parameter' })
  async getTopExpenses(@CurrentUser() user: AuthenticatedUser, @Query() query: TopQueryDto) {
    return this.reportsService.getTopExpenses(user.id, query);
  }

  @Get('by-day-of-week')
  @ApiOperation({
    summary: 'Spending aggregated by day of week',
    description: 'Totals, counts, averages per day of week (Sun-Sat).',
  })
  @ApiResponse({ status: 200, description: 'Day of week aggregates' })
  @ApiResponse({ status: 400, description: 'Invalid query parameter' })
  async getByDayOfWeek(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ByDayOfWeekQueryDto,
  ) {
    return this.reportsService.getByDayOfWeek(user.id, query);
  }

  @Get('export.csv')
  @ApiOperation({
    summary: 'Export expenses as CSV',
    description: 'Returns a CSV file of expenses filtered by the provided query parameters.',
  })
  async exportCsv(@CurrentUser() user: AuthenticatedUser, @Query() query: any): Promise<string> {
    const csv = await this.reportsService.exportCsv(user.id, query);
    return csv;
  }

  @Patch('budgets/:id')
  @ApiOperation({ summary: 'Update a budget amount or start date' })
  @ApiResponse({ status: 200, description: 'Budget updated', type: BudgetDto })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async updateBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetDto> {
    return this.expensesService.updateBudget(user.id, id, dto);
  }

  @Delete('budgets/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiResponse({ status: 200, description: 'Budget deleted', type: Object })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async deleteBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Ack> {
    return this.expensesService.deleteBudget(user.id, id);
  }

  // ----------------------------------------------------------------- expenses

  @Get()
  @ApiOperation({
    summary: 'List expenses',
    description: "Paginated, filterable list of the caller's expenses, newest first by default.",
  })
  @ApiResponse({ status: 200, description: 'Page of expenses', type: PaginatedExpensesResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameter' })
  async listExpenses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExpenseQueryDto,
  ): Promise<PaginatedExpensesResponseDto> {
    return this.expensesService.listExpenses(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record an expense' })
  @ApiResponse({ status: 201, description: 'Expense recorded', type: ExpenseDto })
  @ApiResponse({ status: 400, description: 'Unsupported currency or unknown category' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async createExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expensesService.createExpense(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single expense' })
  @ApiResponse({ status: 200, description: 'Expense detail', type: ExpenseDto })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async getExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExpenseDto> {
    return this.expensesService.getExpense(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an expense' })
  @ApiResponse({ status: 200, description: 'Expense updated', type: ExpenseDto })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async updateExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expensesService.updateExpense(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an expense' })
  @ApiResponse({ status: 200, description: 'Expense deleted', type: Object })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async deleteExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Ack> {
    return this.expensesService.deleteExpense(user.id, id);
  }
}
