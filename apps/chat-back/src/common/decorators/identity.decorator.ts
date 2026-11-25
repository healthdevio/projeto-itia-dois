import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  IdentityRequest,
  RequestIdentity,
} from '../../middleware/identity.js';

export const Identity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestIdentity => {
    const request = ctx.switchToHttp().getRequest<IdentityRequest>();
    if (!request.identity) {
      throw new UnauthorizedException({
        success: false,
        error: 'Identidade de usuário ausente na requisição',
      });
    }
    return request.identity;
  },
);
