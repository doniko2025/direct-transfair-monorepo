// apps/backend/src/i18n/i18n.spec.ts — livre de phrases, courriels et filtre d'erreurs (FR / EN / PT).
import { HttpException, BadRequestException, NotFoundException } from '@nestjs/common';

import { langFromRequest, langOfUser, normalizeLang } from './lang';
import { allEntries, clearMissing, hasPhrase, listMissing, registerPhrases, translatePhrase } from './phrase-book';
import { translateHtml } from './html';
import { translateErrorBody } from './i18n.filter';
import './phrases';

describe('langues', () => {
  it('normalise les étiquettes de langue', () => {
    expect(normalizeLang('pt-BR')).toBe('pt');
    expect(normalizeLang('EN')).toBe('en');
    expect(normalizeLang('fr_FR')).toBe('fr');
    expect(normalizeLang('de')).toBeNull();
    expect(normalizeLang(undefined)).toBeNull();
  });
  it("n'utilise PAS Accept-Language (rempli tout seul par les navigateurs)", () => {
    expect(langFromRequest({ headers: { 'accept-language': 'en-US,en;q=0.9' } })).toBeNull();
    expect(langFromRequest({ headers: { 'x-app-lang': 'pt' } })).toBe('pt');
    expect(langFromRequest({ headers: { 'x-app-lang': ['en'] } })).toBe('en');
  });
  it('langue du compte, sinon français', () => {
    expect(langOfUser({ preferredLanguage: 'en' })).toBe('en');
    expect(langOfUser({ preferredLanguage: null })).toBe('fr');
    expect(langOfUser(undefined)).toBe('fr');
  });
});

describe('livre de phrases', () => {
  beforeAll(() => {
    registerPhrases([
      ['Test A', 'Test A en', 'Test A pt'],
      ['Vous avez envoyé {1} à {2}.', 'You sent {1} to {2}.', 'Enviou {1} para {2}.'],
      ['Vous avez envoyé {1} à {2}. Réf : {3}.', 'You sent {1} to {2}. Ref: {3}.', 'Enviou {1} para {2}. Ref: {3}.'],
      ['Votre {1} est validée.', 'Your {1} has been approved.', 'O seu {1} foi validado.'],
      ['passeport', 'passport', 'passaporte'],
    ]);
  });

  it('le français est rendu tel quel', () => {
    expect(translatePhrase('Test A', 'fr')).toBe('Test A');
  });
  it('traduit une phrase exacte', () => {
    expect(translatePhrase('Test A', 'en')).toBe('Test A en');
    expect(translatePhrase('  Test A ', 'pt')).toBe('Test A pt');
  });
  it('reprend les parties variables, dans l\'ordre de la langue', () => {
    expect(translatePhrase('Vous avez envoyé 10 € à Awa.', 'en')).toBe('You sent 10 € to Awa.');
    expect(translatePhrase('Vous avez envoyé 10 € à Awa.', 'pt')).toBe('Enviou 10 € para Awa.');
  });
  it('la phrase la plus précise gagne (avec ou sans référence)', () => {
    expect(translatePhrase('Vous avez envoyé 10 € à Awa. Réf : TX1.', 'en')).toBe('You sent 10 € to Awa. Ref: TX1.');
  });
  it('traduit aussi une partie variable qui est une phrase connue', () => {
    expect(translatePhrase('Votre passeport est validée.', 'en')).toBe('Your passport has been approved.');
    expect(translatePhrase('Votre CNI est validée.', 'en')).toBe('Your CNI has been approved.');
  });
  it('une phrase inconnue reste en français et est signalée', () => {
    clearMissing();
    expect(translatePhrase('Phrase jamais vue', 'en')).toBe('Phrase jamais vue');
    expect(listMissing()).toContain('Phrase jamais vue');
  });

  it('chaque entrée a une traduction EN et PT, avec les mêmes parties variables', () => {
    const slots = (t: string) => (t.match(/\{\d+\}/g) ?? []).map((x) => x).sort().join(',');
    const bad = allEntries().filter((e) => !e.en.trim() || !e.pt.trim() || slots(e.fr) !== slots(e.en) || slots(e.fr) !== slots(e.pt));
    expect(bad.map((b) => b.fr)).toEqual([]);
  });
});

describe('courriels', () => {
  it('traduit le texte et garde la mise en page', () => {
    registerPhrases([['Bonjour', 'Hello', 'Olá']]);
    const html = '<div style="color:red"><p>Bonjour <strong>Awa</strong>,</p></div>';
    expect(translateHtml(html, 'en')).toBe('<div style="color:red"><p>Hello <strong>Awa</strong>,</p></div>');
    expect(translateHtml(html, 'fr')).toBe(html);
  });
});

describe("filtre d'erreurs", () => {
  it('traduit message (texte ou tableau) sans toucher au reste', () => {
    registerPhrases([['Compte introuvable', 'Account not found', 'Conta não encontrada']]);
    const body = new NotFoundException('Compte introuvable').getResponse();
    expect(translateErrorBody(body, 404, 'en')).toEqual({ message: 'Account not found', error: 'Not Found', statusCode: 404 });
    const arr = new BadRequestException(['Compte introuvable', 'x']).getResponse();
    expect((translateErrorBody(arr, 400, 'pt') as any).message).toEqual(['Conta não encontrada', 'x']);
  });
  it('garde le code métier des réponses objet', () => {
    const body = new HttpException({ statusCode: 403, code: 'VERIFICATION_REQUIRED', message: 'Compte introuvable' }, 403).getResponse();
    expect(translateErrorBody(body, 403, 'en')).toEqual({ statusCode: 403, code: 'VERIFICATION_REQUIRED', message: 'Account not found' });
  });
  it('un message en texte simple prend la forme de Nest', () => {
    expect(translateErrorBody('Compte introuvable', 409, 'en')).toEqual({ statusCode: 409, message: 'Account not found' });
  });
  it('hasPhrase reconnaît les phrases du livre', () => {
    expect(hasPhrase('Compte introuvable')).toBe(true);
    expect(hasPhrase('inconnu au bataillon')).toBe(false);
  });
});

describe('textes composés (KYC, marchand)', () => {
  it('traduit une clôture de caisse en liste « a · b »', () => {
    const fr = 'Variation du solde : 15 000 XOF (3 paiements, 1 remboursement) · 12,50 EUR (1 paiement).';
    expect(translatePhrase(fr, 'en')).toBe('Balance change: 15 000 XOF (3 payments, 1 refund) · 12,50 EUR (1 payment).');
    expect(translatePhrase(fr, 'pt')).toContain('3 pagamentos, 1 reembolso');
  });
  it('traduit une notification KYC à parties variables', () => {
    expect(translatePhrase('Votre passeport est validée. Il reste à envoyer votre selfie pour finaliser la vérification.', 'en')).toBe(
      'Your passport has been approved. You still need to send your selfie to complete the verification.',
    );
    expect(translatePhrase("Votre pièce d'identité expire dans 3 jours", 'pt')).toBe('O seu documento de identificação expira dentro de 3 dias');
  });
});

describe('libellés du reçu', () => {
  it('traduit titre, statut, mode de réception et libellé du montant', () => {
    expect(translatePhrase('PAYÉ', 'en')).toBe('PAID');
    expect(translatePhrase('DISPONIBLE — À RETIRER', 'pt')).toBe('DISPONÍVEL — PARA LEVANTAR');
    expect(translatePhrase("Envoi d'argent — retrait en agence", 'en')).toBe('Money transfer — agency pick-up');
    expect(translatePhrase('Crédit sur portefeuille', 'pt')).toBe('Crédito na carteira');
    expect(translatePhrase('Montant à retirer', 'en')).toBe('Amount to collect');
  });
  it('translateReceiptLabels ne touche ni aux montants ni aux noms', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { translateReceiptLabels } = require('../transactions/transfer-receipt');
    const doc: any = {
      title: 'Virement bancaire', statusLabel: 'ANNULÉ', reference: 'TF123', sender: { name: 'Awa Diallo' },
      payout: { method: 'MOBILE_MONEY', methodLabel: 'Mobile Money', country: 'GN' },
      hero: { label: "Montant de l'envoi", amount: 5000, currency: 'XOF' },
    };
    const out = translateReceiptLabels(doc, (t: string) => translatePhrase(t, 'en'));
    expect(out.title).toBe('Bank transfer');
    expect(out.statusLabel).toBe('CANCELLED');
    expect(out.hero).toEqual({ label: 'Transfer amount', amount: 5000, currency: 'XOF' });
    expect(out.sender.name).toBe('Awa Diallo');
    expect(out.reference).toBe('TF123');
  });
});
