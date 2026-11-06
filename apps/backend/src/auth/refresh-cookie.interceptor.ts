// apps/backend/src/auth/refresh-cookie.interceptor.ts
// Intercepteur global : pour le portail web, tout corps de réponse qui contient un `refresh_token` (connexion, OTP, SSO,
// renouvellement…) voit ce champ déplacé dans le cookie httpOnly (voir refresh-cookie.ts). Une seule règle pour toutes les routes
// qui émettent des jetons : aucune ne peut oublier de protéger le refresh token.
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { isWebClient, setRefreshCookie } from './refresh-cookie';

@Injectable()
export class RefreshCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest();
    if (!isWebClient(req)) return next.handle();
    const res = http.getResponse();

    return next.handle().pipe(
      map((body: unknown) => {
        if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
        const token = (body as { refresh_token?: unknown }).refresh_token;
        if (typeof token !== 'string' || !token) return body;
        setRefreshCookie(res, token);
        const { refresh_token: _removed, ...rest } = body as Record<string, unknown>;
        return rest;
      }),
    );
  }
}
