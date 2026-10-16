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
import { RecurringExpensesService } from './recurring-expenses.service';
import {
  ConfirmManyOccurrencesDto,
  ConfirmOccurrenceDto,
  CreateRecurringExpenseDto,
  RecurringOccurrenceQueryDto,
  UpdateRecurringExpenseDto,
} from './dto/recurring-expense.dto';
import {
  ConfirmOccurrencesResponseDto,
  PaginatedOccurrencesResponseDto,
  RecurringExpenseDto,
} from './dto/recurring-expense-response.dto';
import { ExpenseDto } from './dto/expense-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

type Ack = { success: boolean; message: string };

/**
 * Recurring expenses live under their own prefix so the `expenses/:id` routes
 * never have to distinguish a rule id from an expense id.
 *
 * As in `ExpensesController`, static segments are declared before `:id` because
 * route order is load-bearing.
 */
@ApiTags('Recurring expenses')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('expenses/recurring')
export class RecurringExpensesController {
  constructor(private readonly recurringExpensesService: RecurringExpensesService) {}

  // ------------------------------------------------------------------- rules

  @Get()
  @ApiOperation({
    summary: 'List recurring expense rules',
    description:
      'Catching up every active rule to today first, so a due occurrence always shows up. Includes each rule’s pending count and next due date.',
  })
  @ApiResponse({ status: 200, description: 'Recurring rules', type: [RecurringExpenseDto] })
  async listRules(@CurrentUser() user: AuthenticatedUser): Promise<RecurringExpenseDto[]> {
    return this.recurringExpensesService.listRules(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a recurring expense rule' })
  @ApiResponse({ status: 201, description: 'Rule created', type: RecurringExpenseDto })
  @ApiResponse({ status: 400, description: 'Malformed cadence or unsupported currency' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringExpenseDto,
  ): Promise<RecurringExpenseDto> {
    return this.recurringExpensesService.createRule(user.id, dto);
  }

  // ------------------------------------------------------------- occurrences
  // Declared before `:id` so "occurrences" is never read as a rule id.

  @Get('occurrences')
  @ApiOperation({
    summary: 'List recurring occurrences',
    description:
      'Pending occurrences awaiting confirmation or skip, plus confirmed and skipped history. Catching up active rules to today first.',
  })
  @ApiResponse({ status: 200, description: 'Occurrences', type: PaginatedOccurrencesResponseDto })
  async listOccurrences(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecurringOccurrenceQueryDto,
  ): Promise<PaginatedOccurrencesResponseDto> {
    return this.recurringExpensesService.listOccurrences(user.id, query);
  }

  @Post('occurrences/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm several pending occurrences at once',
    description:
      'Posts one expense per pending occurrence. Omit `ids` to confirm every pending occurrence.',
  })
  @ApiResponse({ status: 200, description: 'Count confirmed', type: ConfirmOccurrencesResponseDto })
  async confirmMany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmManyOccurrencesDto,
  ): Promise<ConfirmOccurrencesResponseDto> {
    return this.recurringExpensesService.confirmMany(user.id, dto.ids);
  }

  @Post('occurrences/:id/confirm')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Confirm a pending occurrence',
    description:
      'Records an expense for the occurrence, applying any overrides in the body. The occurrence is claimed atomically, so a double submit yields a conflict rather than a duplicate expense.',
  })
  @ApiResponse({ status: 201, description: 'Expense recorded', type: ExpenseDto })
  @ApiResponse({ status: 404, description: 'Occurrence not found' })
  @ApiResponse({ status: 409, description: 'Occurrence already confirmed or skipped' })
  async confirmOccurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmOccurrenceDto,
  ): Promise<ExpenseDto> {
    return this.recurringExpensesService.confirmOccurrence(user.id, id, dto);
  }

  @Post('occurrences/:id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Skip a pending occurrence',
    description: 'Marks the occurrence as skipped without recording an expense.',
  })
  @ApiResponse({ status: 200, description: 'Occurrence skipped', type: Object })
  @ApiResponse({ status: 404, description: 'Occurrence not found' })
  @ApiResponse({ status: 409, description: 'Occurrence already confirmed or skipped' })
  async skipOccurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Ack> {
    return this.recurringExpensesService.skipOccurrence(user.id, id);
  }

  // ----------------------------------------------------------------- rule ids
  // Declared after the static occurrence routes above.

  @Get(':id')
  @ApiOperation({ summary: 'Get a recurring expense rule' })
  @ApiResponse({ status: 200, description: 'Rule', type: RecurringExpenseDto })
  @ApiResponse({ status: 404, description: 'Recurring expense not found' })
  async getRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecurringExpenseDto> {
    return this.recurringExpensesService.getRule(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a recurring expense rule',
    description:
      'Payload edits (amount, currency, category, description, payment method) also resync pending occurrences, which are not history yet. Occurrences already confirmed or skipped keep the values they were recorded with.',
  })
  @ApiResponse({ status: 200, description: 'Rule updated', type: RecurringExpenseDto })
  @ApiResponse({ status: 400, description: 'Malformed cadence or unsupported currency' })
  @ApiResponse({ status: 404, description: 'Recurring expense not found' })
  async updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringExpenseDto,
  ): Promise<RecurringExpenseDto> {
    return this.recurringExpensesService.updateRule(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a recurring expense rule',
    description:
      'Removes the rule and its occurrences. Expenses it already produced are kept as ordinary history.',
  })
  @ApiResponse({ status: 200, description: 'Rule deleted', type: Object })
  @ApiResponse({ status: 404, description: 'Recurring expense not found' })
  async deleteRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Ack> {
    return this.recurringExpensesService.deleteRule(user.id, id);
  }
}
