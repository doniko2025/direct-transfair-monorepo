// apps/direct-transfair-mobile/i18n/catalog.ts
// Assemble tous les modules de textes. Un nouveau module = une ligne ici.
import type { Trio } from './core';
import { common } from './messages/common';
import { auth } from './messages/auth';
import { account } from './messages/account';
import { home } from './messages/home';
import { transfer } from './messages/transfer';
import { activity } from './messages/activity';
import { profile } from './messages/profile';
import { merchant } from './messages/merchant';
import { legal } from './messages/legal';

export const CATALOG = { ...common, ...auth, ...account, ...home, ...transfer, ...activity, ...profile, ...merchant, ...legal } as const satisfies Record<string, Trio>;
export type MessageKey = keyof typeof CATALOG;
