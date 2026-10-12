// apps/backend/src/auth/dto/register.dto.spec.ts
// Phase 6 — l'inscription publique ignore `role` (plus d'auto-création de compte AGENT).
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './register.dto';

describe('RegisterDto — champ role', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const body = {
    firstName: 'Awa', lastName: 'Diallo', email: 'awa@example.com', password: 'secret12',
  };

  it('retire un `role` envoyé par l\'appelant (AGENT, COMPANY_ADMIN, SUPER_ADMIN…)', async () => {
    for (const role of ['AGENT', 'COMPANY_ADMIN', 'SUPER_ADMIN', 'USER']) {
      const out: any = await pipe.transform({ ...body, role }, { type: 'body', metatype: RegisterDto });
      expect(out.role).toBeUndefined();
      expect(out.email).toBe('awa@example.com');
    }
  });

  it('RegisterDto ne déclare plus de propriété role', () => {
    const dto = Object.assign(new RegisterDto(), body);
    expect('role' in dto).toBe(false);
  });
});
