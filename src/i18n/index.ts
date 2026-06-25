import type { Locale } from '@/game/types';
import en from './en';
import ar from './ar';

export type MessageSchema = typeof en;

export const messages: Record<Locale, MessageSchema> = { en, ar };
