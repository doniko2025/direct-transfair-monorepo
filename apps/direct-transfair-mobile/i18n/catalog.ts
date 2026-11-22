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
import { theme } from './messages/theme';
import { bills } from './messages/bills';
import { growth } from './messages/growth';
import { assist } from './messages/assist';

export const CATALOG = { ...common, ...auth, ...account, ...home, ...transfer, ...activity, ...profile, ...merchant, ...legal, ...theme, ...bills, ...growth, ...assist } as const satisfies Record<string, Trio>;
export type MessageKey = keyof typeof CATALOG;
