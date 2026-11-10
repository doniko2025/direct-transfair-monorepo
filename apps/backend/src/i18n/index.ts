// apps/backend/src/i18n/index.ts
export * from './lang';
export { translatePhrase, registerPhrases, hasPhrase, listMissing, clearMissing, allEntries, type Phrase } from './phrase-book';
export { translateHtml } from './html';
export { I18nExceptionFilter, translateMessage, translateErrorBody } from './i18n.filter';
import './phrases';
