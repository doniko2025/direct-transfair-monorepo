// apps/direct-transfair-mobile/i18n/messages/theme.ts
// Textes du thème clair / sombre et de la page « Préférences » (préfixe th.*).
import type { Trio } from '../core';

export const theme = {
  'th.title':      { fr: 'Préférences', en: 'Preferences', pt: 'Preferências' },
  'th.subtitle':   { fr: "Personnalisez l'apparence et la langue de l'application.", en: "Customize the app's appearance and language.", pt: 'Personalize a aparência e o idioma da aplicação.' },
  'th.appearance': { fr: 'Apparence', en: 'Appearance', pt: 'Aparência' },
  'th.choose':     { fr: 'Choisir le thème', en: 'Choose a theme', pt: 'Escolher o tema' },
  'th.change':     { fr: 'Changer le thème', en: 'Change theme', pt: 'Mudar o tema' },
  'th.current':    { fr: 'Thème actuel : {name}', en: 'Current theme: {name}', pt: 'Tema atual: {name}' },
  'th.light':      { fr: 'Clair', en: 'Light', pt: 'Claro' },
  'th.dark':       { fr: 'Sombre', en: 'Dark', pt: 'Escuro' },
  'th.auto':       { fr: 'Automatique', en: 'Automatic', pt: 'Automático' },
  'th.lightSub':   { fr: 'Fond blanc, lisible en plein jour.', en: 'White background, easy to read in daylight.', pt: 'Fundo branco, legível à luz do dia.' },
  'th.darkSub':    { fr: 'Fond sombre, reposant le soir et plus économe sur les écrans OLED.', en: 'Dark background, easier on the eyes at night and lighter on OLED battery.', pt: 'Fundo escuro, mais confortável à noite e poupa bateria em ecrãs OLED.' },
  'th.autoSub':    { fr: 'Suit le réglage de votre téléphone, de jour comme de nuit.', en: "Follows your phone's setting, day and night.", pt: 'Segue a definição do seu telemóvel, de dia e de noite.' },
  'th.autoNow':    { fr: 'Actuellement : {name}', en: 'Currently: {name}', pt: 'Atualmente: {name}' },
  'th.hint':       { fr: "Le thème s'applique tout de suite et reste enregistré sur cet appareil.", en: 'The theme applies immediately and is saved on this device.', pt: 'O tema aplica-se de imediato e fica guardado neste dispositivo.' },
  'th.rowSub':     { fr: '{theme} · {lang}', en: '{theme} · {lang}', pt: '{theme} · {lang}' },
  'th.languageHint': { fr: 'Langue des écrans, des messages et des e-mails.', en: 'Language of screens, messages and emails.', pt: 'Idioma dos ecrãs, das mensagens e dos e-mails.' },
} as const satisfies Record<string, Trio>;
