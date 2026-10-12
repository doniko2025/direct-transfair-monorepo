// apps/backend/src/app.module.ts
// =========================================================
// APP MODULE v5.3
// ✅ v5.3 : AgentDeskModule — /agent-desk (caisse de l'agence, opérations du jour, recherche client, aperçu d'un envoi cash).
// ✅ v5.2 : CommissionRulesModule — /commission-rules (répartition des frais d'un retrait payé : agence d'envoi,
//   agence payeuse, société ; lecture super admin, modification admin de société).
// ✅ v5.2 : FeeScheduleModule — /fees-admin/rules et /fees-admin/quote (barème de frais par société).
// ✅ v5.1 : AgentsAdminModule — /agents-admin (agents d'une société rattachés à une agence).
// ✅ v5.0 : FeesAdminModule — /fees-admin (frais d'envoi par société : lecture super admin,
//   modification admin de société, journal des modifications).
// ✅ v4.9 : RatesAdminModule — /rates-admin (taux de change : liste, historique,
//   enregistrement réservé au super admin avec sens inverse, historique et audit).
//   Les anciennes routes d'écriture POST /rates et PATCH /exchange-rates/:pair
//   sont désormais protégées (voir leurs contrôleurs).
// ✅ v4.8 : SupervisionModule — /supervision/overview|audit-logs|alerts.
//   Le mobile appelait /audit-logs et /alerts qui n'existaient pas.
// ✅ v4.7 : correctif rate limiting — les throttlers nommés `auth` (5/min) et
//   `otp` (10/h) s'appliquaient à toutes les routes (429 « Trop de tentatives »
//   après quelques requêtes). Config déplacée dans common/throttle.config.ts.
// ✅ v4.4 : exclusion auth/v2/(.*) du TenantMiddleware
// ✅ v4.5 : ThrottlerModule global — rate limiting par IP
//   Prérequis : npm install @nestjs/throttler
//
//   3 niveaux configurés :
//   — default : 100 req / 60s  (APIs normales)
//   — auth    :   5 req / 60s  (login, register → @Throttle sur controller)
//   — otp     :  10 req /  1h  (envoi OTP → @Throttle sur controller)
//
//   APP_GUARD ThrottlerGuard appliqué globalement.
//   Exempter une route : @SkipThrottle() sur le handler.
//
// ✅ v4.6 : Ajout AgencyTreasuryModule — trésorerie agence ⇄ société
//   (fichiers indépendants, voir transactions/agency-treasury.*).
//   Expose POST /transactions/agency/remit (agent → société) et
//   POST /transactions/agency/collect (société → agence). Seule
//   ligne touchée dans ce fichier en dehors de l'import : l'ajout de
//   AgencyTreasuryModule dans le tableau imports ci-dessous —
//   TransactionsModule et tout le reste restent strictement
//   inchangés.
// =========================================================

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // ✅ v4.5
import { APP_GUARD }    from '@nestjs/core';                          // ✅ v4.5

import { PrismaModule }   from './prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';
import { MailModule }     from './mail/mail.module';
import { SmsModule }      from './sms/sms.module';
import { PushModule }     from './push/push.module';

import { NotificationsModule }      from './notifications/notifications.module';
import { UsersModule }              from './users/users.module';
import { ClientsModule }            from './clients/clients.module';
import { TenantsModule }            from './tenants/tenants.module';
import { AuthModule }               from './auth/auth.module';
import { BeneficiariesModule }      from './beneficiaries/beneficiaries.module';
import { TransactionsModule }       from './transactions/transactions.module';
import { AgencyTreasuryModule }     from './transactions/agency-treasury.module'; // ✅ v4.6
import { PaymentsModule }           from './payments/payments.module';
import { WithdrawalsModule }        from './withdrawals/withdrawals.module';
import { RatesModule }              from './rates/rates.module';
import { AgenciesModule }           from './agencies/agencies.module';
import { CommissionsModule }        from './commissions/commissions.module';
import { WalletsModule }            from './wallets/wallets.module';
import { TreasuryModule }           from './treasury/treasury.module';
import { ScheduledTransfersModule } from './scheduled-transfers/scheduled-transfers.module';
import { RateAlertsModule }         from './rate-alerts/rate-alerts.module';
import { LimitsModule }             from './limits/limits.module';
import { LocationsModule }          from './locations/locations.module';
import { SupervisionModule }        from './supervision/supervision.module'; // ✅ v4.8
import { RatesAdminModule }         from './rates-admin/rates-admin.module'; // ✅ v4.9
import { FeesAdminModule }          from './fees-admin/fees-admin.module';   // ✅ v5.0
import { AgentsAdminModule }        from './agents-admin/agents-admin.module'; // ✅ v5.1
import { FeeScheduleModule }        from './fee-schedule/fee-schedule.module'; // ✅ v5.2
import { CommissionRulesModule }    from './commission-rules/commission-rules.module'; // ✅ v5.2
import { AgentDeskModule }          from './agent-desk/agent-desk.module'; // ✅ v5.3

import { THROTTLERS }              from './common/throttle.config'; // ✅ v4.7
import { TenantMiddleware }        from './tenants/tenant.middleware';
import { ExchangeRatesController } from './exchange-rates/exchange-rates.controller';
import { ExchangeRatesService }    from './exchange-rates/exchange-rates.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    // ✅ v4.5 : Rate limiting global par IP
    // ✅ v4.7 : `auth` et `otp` ne s'appliquent plus qu'aux routes qui les demandent
    //   (@Throttle) — avant, ils limitaient TOUTES les routes à 5/min et 10/h.
    //   Voir common/throttle.config.ts.
    ThrottlerModule.forRoot(THROTTLERS),

    PrismaModule,
    PlatformModule,
    MailModule,
    SmsModule,
    PushModule,
    NotificationsModule,
    UsersModule,
    ClientsModule,
    TenantsModule,
    AuthModule,
    BeneficiariesModule,
    TransactionsModule,
    AgencyTreasuryModule, // ✅ v4.6 — remontée agent → société + retrait admin → agence
    PaymentsModule,
    WithdrawalsModule,
    RatesModule,
    AgenciesModule,
    CommissionsModule,
    WalletsModule,
    TreasuryModule,
    ScheduledTransfersModule,
    RateAlertsModule,
    LimitsModule,
    LocationsModule,
    SupervisionModule, // ✅ v4.8 — /supervision/* (audit, alertes, santé)
    RatesAdminModule,  // ✅ v4.9 — /rates-admin/* (administration des taux)
    FeesAdminModule,   // ✅ v5.0 — /fees-admin/* (frais d'envoi par société)
    AgentsAdminModule, // ✅ v5.1 — /agents-admin/* (agents rattachés à une agence)
    FeeScheduleModule, // ✅ v5.2 — /fees-admin/rules, /fees-admin/quote (barème de frais)
    CommissionRulesModule, // ✅ v5.2 — /commission-rules (répartition des frais)
    AgentDeskModule,   // ✅ v5.3 — /agent-desk/* (guichet de l'agent)
  ],

  controllers: [ExchangeRatesController],

  providers: [
    ExchangeRatesService,
    // ✅ v4.5 : ThrottlerGuard appliqué globalement sur toutes les routes
    {
      provide:  APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        'auth/login',
        'auth/register',
        'auth/refresh',
        'auth/v2/(.*)',       // ✅ v4.4
        'branding',
        'branding/(.*)',      // ✅ v4.3
        'swagger',
        'swagger/(.*)',
        'health',
        'admin/tenants',
        'admin/tenants/(.*)',
        'locations',
        'locations/(.*)',
      )
      .forRoutes('*');
  }
}