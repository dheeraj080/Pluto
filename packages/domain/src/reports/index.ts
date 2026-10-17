/**
 * Report aggregation shared by the clients.
 *
 * `engine` is a faithful port of the server's `ExpensesReportsService` so a
 * report computed on-device matches the one the server would return; `types`
 * mirrors the report DTOs structurally.
 */
export * from './engine';
export * from './types';
export { divideMultiplyRound2, roundHalfUp2 } from './decimal';
