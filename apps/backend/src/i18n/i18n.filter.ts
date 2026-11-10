// apps/backend/src/i18n/i18n.filter.ts
// =========================================================
// FILTRE D'ERREURS TRADUIT — les messages d'erreur (HttpException) sortent dans la langue de l'application mobile (en-tête x-app-lang).
// Sans l'en-tête (back-office web, appels existants) ou en français : réponse STRICTEMENT identique à celle de Nest par défaut.
// Seuls les champs `message` sont traduits ; code, statut et `error` ne bougent pas.
// =========================================================

import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { langFromRequest, type Lang } from './lang';
import { translatePhrase } from './phrase-book';
import './phrases'; // enregistre les dictionnaires

export function translateMessage(message: unknown, lang: Lang): unknown {
  if (typeof message === 'string') return translatePhrase(message, lang);
  if (Array.isArray(message)) return message.map((m) => (typeof m === 'string' ? translatePhrase(m, lang) : m));
  return message;
}

export function translateErrorBody(body: unknown, status: number, lang: Lang): Record<string, unknown> {
  if (typeof body === 'string') return { statusCode: status, message: translateMessage(body, lang) };
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    return 'message' in obj ? { ...obj, message: translateMessage(obj.message, lang) } : obj;
  }
  return { statusCode: status, message: body };
}

@Catch(HttpException)
export class I18nExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const lang = langFromRequest(req as any) ?? 'fr';
    res.status(status).json(translateErrorBody(exception.getResponse(), status, lang));
  }
}
