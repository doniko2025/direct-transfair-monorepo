// apps/direct-transfair-mobile/i18n/messages/common.ts
// Textes communs à toute l'application (boutons, états, sélecteur de langue). Une entrée = { fr, en, pt }.
import type { Trio } from '../core';

export const common = {
  // ── Boutons et actions courantes ──
  'common.ok':        { fr: 'OK',         en: 'OK',        pt: 'OK' },
  'common.cancel':    { fr: 'Annuler',    en: 'Cancel',    pt: 'Cancelar' },
  'common.confirm':   { fr: 'Confirmer',  en: 'Confirm',   pt: 'Confirmar' },
  'common.retry':     { fr: 'Réessayer',  en: 'Try again', pt: 'Tentar novamente' },
  'common.back':      { fr: 'Retour',     en: 'Back',      pt: 'Voltar' },
  'common.close':     { fr: 'Fermer',     en: 'Close',     pt: 'Fechar' },
  'common.save':      { fr: 'Enregistrer', en: 'Save',     pt: 'Guardar' },
  'common.continue':  { fr: 'Continuer',  en: 'Continue',  pt: 'Continuar' },
  'common.next':      { fr: 'Suivant',    en: 'Next',      pt: 'Seguinte' },
  'common.validate':  { fr: 'Valider',    en: 'Confirm',   pt: 'Validar' },
  'common.later':     { fr: 'Plus tard',  en: 'Later',     pt: 'Mais tarde' },
  'common.enable':    { fr: 'Activer',    en: 'Enable',    pt: 'Ativar' },
  'common.loading':   { fr: 'Chargement…', en: 'Loading…', pt: 'A carregar…' },
  'common.error':     { fr: 'Erreur',     en: 'Error',     pt: 'Erro' },
  'common.success':   { fr: 'Succès',     en: 'Success',   pt: 'Sucesso' },
  'common.search':    { fr: 'Rechercher', en: 'Search',    pt: 'Pesquisar' },

  // ── Sélecteur de langue ──
  'lang.title':       { fr: 'Langue',                    en: 'Language',                  pt: 'Idioma' },
  'lang.choose':      { fr: 'Choisir la langue',         en: 'Choose language',           pt: 'Escolher o idioma' },
  'lang.subtitle':    { fr: "Langue de l'application, des emails et des notifications.", en: 'Language of the app, emails and notifications.', pt: 'Idioma da aplicação, dos emails e das notificações.' },
  'lang.current':     { fr: 'Langue actuelle : {name}',  en: 'Current language: {name}',  pt: 'Idioma atual: {name}' },
  'lang.change':      { fr: 'Changer de langue',         en: 'Change language',           pt: 'Mudar de idioma' },
  'lang.selected':    { fr: 'sélectionnée',              en: 'selected',                  pt: 'selecionado' },
} as const satisfies Record<string, Trio>;
