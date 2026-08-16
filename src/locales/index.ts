import { en } from './en';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { ja } from './ja';
import { ko } from './ko';
import { pt_BR } from './pt-BR';
import { zh_Hans } from './zh-Hans';
import { zh_Hant } from './zh-Hant';

export type { Messages, MessageKey } from './en';

/// Every locale the iOS app ships, so a share link opened by a
/// recipient reads in the same language their copy of Splitea
/// would. Order is irrelevant; lookup is by exact tag.
export const messages = {
  en,
  "de": de,
  "es": es,
  "fr": fr,
  "it": it,
  "ja": ja,
  "ko": ko,
  "pt-BR": pt_BR,
  "zh-Hans": zh_Hans,
  "zh-Hant": zh_Hant,
} as const;

export type Locale = keyof typeof messages;
export const LOCALES = Object.keys(messages) as Locale[];
