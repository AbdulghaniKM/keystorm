import type { Locale, WeaknessVector } from '@/game/types';
import { extractBigrams, weakBigrams, errorRate } from '@/game/bigrams';

const ENGLISH_WORDS: string[] = [
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
  'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that',
  'with', 'have', 'from', 'they', 'know', 'want', 'been', 'good', 'much',
  'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long',
  'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were',
  'what', 'work', 'year', 'back', 'call', 'came', 'each', 'find', 'give',
  'hand', 'high', 'keep', 'last', 'left', 'life', 'live', 'most', 'name',
  'need', 'next', 'open', 'part', 'play', 'said', 'same', 'seem', 'show',
  'side', 'tell', 'turn', 'used', 'walk', 'word', 'world', 'about', 'after',
  'again', 'still', 'their', 'there', 'these', 'thing', 'think', 'three',
  'where', 'which', 'while', 'would', 'first', 'great', 'house', 'large',
  'light', 'might', 'never', 'other', 'place', 'point', 'right', 'small',
  'sound', 'start', 'state', 'story', 'study', 'water', 'storm', 'bridge',
  'child', 'field', 'fresh', 'chest', 'shield', 'strong', 'change', 'should',
  'nation', 'action', 'motion', 'option', 'branch', 'thread', 'breath',
  // Longer, code-flavored tier — more variety, and length scales the threat.
  'return', 'import', 'export', 'public', 'static', 'number', 'string', 'object',
  'commit', 'merge', 'deploy', 'server', 'client', 'schema', 'cursor', 'buffer',
  'syntax', 'render', 'filter', 'reduce', 'handler', 'payload', 'request',
  'response', 'promise', 'boolean', 'compile', 'runtime', 'builder', 'default',
  'extends', 'private', 'function', 'iterator', 'operator', 'variable',
  'constant', 'argument', 'callback', 'template', 'instance', 'override',
];

const ARABIC_WORDS: string[] = [
  'بيت', 'كتاب', 'مدرسة', 'شمس', 'قمر', 'ماء', 'نهر', 'جبل', 'طريق', 'مدينة',
  'باب', 'قلم', 'ورد', 'شجر', 'بحر', 'سماء', 'ارض', 'نار', 'ريح', 'ثلج',
  'مطر', 'سحاب', 'نجم', 'صباح', 'مساء', 'ليل', 'نهار', 'سنة', 'شهر', 'يوم',
  'ساعة', 'وقت', 'عمل', 'علم', 'فكر', 'قلب', 'عقل', 'روح', 'حب', 'سلام',
  'فرح', 'حزن', 'خير', 'شر', 'نور', 'ظل', 'حجر', 'رمل', 'تراب', 'ذهب',
  'فضة', 'حديد', 'خشب', 'زجاج', 'ورق', 'حبر', 'لون', 'صوت', 'كلمة', 'جملة',
  'سطر', 'صفحة', 'درس', 'سؤال', 'جواب', 'معلم', 'طالب', 'صديق', 'جار', 'اسرة',
  'ام', 'اب', 'اخ', 'اخت', 'جد', 'ابن', 'بنت', 'ولد', 'رجل', 'امراة',
  'طفل', 'وجه', 'عين', 'يد', 'رجل', 'راس', 'شعر', 'فم', 'انف', 'اذن',
  'طعام', 'خبز', 'لحم', 'سمك', 'فاكهة', 'عنب', 'تفاح', 'تمر', 'عسل', 'حليب',
  'قهوة', 'شاي', 'سكر', 'ملح', 'زيت', 'مفتاح', 'كرسي', 'طاولة', 'سرير', 'باص',
  'سيارة', 'قطار', 'طائرة', 'سفينة', 'حقل', 'زرع', 'حصاد', 'حديقة', 'زهرة', 'طير',
  'سمكة', 'حصان', 'جمل', 'اسد', 'نمر', 'ذئب', 'قط', 'كلب', 'فيل', 'غزال',
  'برنامج', 'حاسوب', 'شبكة', 'برمجة', 'متغير', 'دالة', 'مصفوفة', 'خوارزمية',
  'ذاكرة', 'معالج', 'نظام', 'ملف', 'مجلد', 'رابط', 'خادم', 'قاعدة', 'بيانات',
  'تطبيق', 'واجهة', 'تصميم', 'تطوير', 'اختبار',
];

export const WORD_POOLS: Record<Locale, string[]> = {
  en: ENGLISH_WORDS,
  ar: ARABIC_WORDS,
};

function pickRandom(pool: string[], rng: () => number): string {
  const index = Math.floor(rng() * pool.length);
  return pool[Math.min(index, pool.length - 1)];
}

function isWeakWord(word: string, weakSet: Set<string>): boolean {
  return extractBigrams(word).some((bigram) => weakSet.has(bigram));
}

function masteryError(word: string, weakness: WeaknessVector): number {
  const bigrams = extractBigrams(word);
  if (bigrams.length === 0) return 0;
  const total = bigrams.reduce((sum, bigram) => sum + errorRate(weakness[bigram]), 0);
  return total / bigrams.length;
}

function pickMasteredWord(pool: string[], weakness: WeaknessVector, rng: () => number): string {
  const sampleA = pickRandom(pool, rng);
  const sampleB = pickRandom(pool, rng);
  return masteryError(sampleA, weakness) <= masteryError(sampleB, weakness) ? sampleA : sampleB;
}

function pickWeakWord(pool: string[], weakSet: Set<string>, rng: () => number): string {
  const candidates = pool.filter((word) => isWeakWord(word, weakSet));
  return candidates.length > 0 ? pickRandom(candidates, rng) : pickRandom(pool, rng);
}

export function selectWord(
  locale: Locale,
  weakness: WeaknessVector,
  rng: () => number = Math.random,
  weakBias: number = 0.3,
): string {
  const pool = WORD_POOLS[locale] ?? [];
  if (pool.length === 0) return '';

  const weakSet = new Set(weakBigrams(weakness));
  if (weakSet.size === 0) return pickRandom(pool, rng);

  return rng() < weakBias
    ? pickWeakWord(pool, weakSet, rng)
    : pickMasteredWord(pool, weakness, rng);
}
