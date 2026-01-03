// apps/backend/src/auth/get-user.decorator.ts
// apps/backend/src/auth/get-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUserPayload = {
  userId: number;
  email: string;
};

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUserPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUserPayload }>();
    return request.user;
  },
);
