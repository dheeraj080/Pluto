/**
 * The profile patch queue's verdict rule.
 *
 * A parked `PATCH /users/me` replays until the server judges it: an answer
 * the device never got (unreachable, stale token, transient 5xx) keeps the
 * patch queued — dropping it would silently lose the user's choice — while a
 * 4xx the server *did* answer voids it, because replaying could only fail the
 * same way and the optimistic session value has to mean something.
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '@pluto/api-client';

import { profilePatchDisposition } from './profile-patch';

describe('profilePatchDisposition', () => {
  it('keeps the patch when the server was never reached', () => {
    expect(profilePatchDisposition(new ApiError(0, 'Could not reach the server.'))).toBe('keep');
    expect(profilePatchDisposition(new TypeError('fetch failed'))).toBe('keep');
  });

  it('keeps the patch while the access token may still rotate', () => {
    expect(profilePatchDisposition(new ApiError(401, 'Unauthorized'))).toBe('keep');
  });

  it('keeps the patch on transient server failures', () => {
    expect(profilePatchDisposition(new ApiError(500, 'Internal Server Error'))).toBe('keep');
    expect(profilePatchDisposition(new ApiError(502, 'Bad Gateway'))).toBe('keep');
  });

  it('drops the patch the server answered and refused', () => {
    expect(profilePatchDisposition(new ApiError(400, 'Bad Request'))).toBe('drop');
    expect(profilePatchDisposition(new ApiError(403, 'Forbidden'))).toBe('drop');
    expect(profilePatchDisposition(new ApiError(422, 'Unprocessable Entity'))).toBe('drop');
  });
});
