import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Restricts access to users on a paid plan.
 *
 * Runs after the global JwtAuthGuard, which populates request.user with the
 * plan selected by JwtStrategy. Fails closed if no user is attached.
 */
@Injectable()
export class PlanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.plan !== 'PAID') {
      throw new ForbiddenException('Paid plan required');
    }

    return true;
  }
}
