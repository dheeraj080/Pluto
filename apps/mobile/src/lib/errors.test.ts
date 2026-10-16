import { describe, expect, it } from 'vitest';
import { ApiError } from '@pluto/api-client';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('prefers an ApiError message over a generic Error', () => {
    expect(errorMessage(new ApiError(400, 'Bad request.'))).toBe('Bad request.');
    expect(errorMessage(new Error('Generic.'))).toBe('Generic.');
  });

  it('returns null for a falsy value', () => {
    expect(errorMessage(null)).toBeNull();
    expect(errorMessage(undefined)).toBeNull();
  });

  it('falls through to the fallback for an unknown shape', () => {
    expect(errorMessage({} as unknown)).toBe('Something went wrong.');
  });
});
