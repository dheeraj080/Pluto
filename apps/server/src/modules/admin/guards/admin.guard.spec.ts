import {
  ContextType,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  function createContext(user?: Partial<AuthenticatedUser>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getType: () => 'http' as ContextType,
    } as unknown as ExecutionContext;
  }

  const adminUser: Partial<AuthenticatedUser> = {
    id: 'admin-id',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  const regularUser: Partial<AuthenticatedUser> = {
    id: 'user-id',
    email: 'user@example.com',
    role: 'USER',
  };

  it('allows requests from ADMIN users', () => {
    expect(guard.canActivate(createContext(adminUser as AuthenticatedUser))).toBe(true);
  });

  it('rejects USER role with 403 Forbidden', () => {
    expect(() => guard.canActivate(createContext(regularUser as AuthenticatedUser))).toThrow(
      ForbiddenException,
    );
  });

  it('fails closed when no user is attached', () => {
    expect(() => guard.canActivate(createContext(undefined))).toThrow(UnauthorizedException);
  });
});
