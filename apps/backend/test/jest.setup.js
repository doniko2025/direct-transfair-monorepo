// apps/backend/test/jest.setup.js
// Tests hermétiques : une variable restée dans le terminal ne doit pas changer le résultat des specs.
// (KYC_ENFORCEMENT=off désactive le blocage KYC et les rappels ; RATE_MAX_AGE_HOURS change le contrôle d'ancienneté des taux.)
// Les specs qui testent ces variables les posent elles-mêmes dans le test concerné.
delete process.env.KYC_ENFORCEMENT;
delete process.env.RATE_MAX_AGE_HOURS;
