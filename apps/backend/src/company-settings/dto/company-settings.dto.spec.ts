// Le ValidationPipe global a « whitelist: true » : tout champ sans décorateur est supprimé EN SILENCE.
// Ce test garantit que les sections merchant / refunds / bills de PATCH /company-settings arrivent jusqu'au service.
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';

import { UpdateCompanySettingsDto } from './company-settings.dto';

describe('UpdateCompanySettingsDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
  const meta = { type: 'body' as const, metatype: UpdateCompanySettingsDto };

  it.each(['merchant', 'refunds', 'bills'])('conserve la section « %s »', async (section) => {
    const out = (await pipe.transform({ [section]: { enabled: true } }, meta)) as Record<string, unknown>;
    expect(out[section]).toEqual({ enabled: true });
  });

  it('supprime toujours un champ inconnu', async () => {
    const out = (await pipe.transform({ bills: { enabled: true }, pirate: 1 }, meta)) as Record<string, unknown>;
    expect(out.pirate).toBeUndefined();
  });
});
