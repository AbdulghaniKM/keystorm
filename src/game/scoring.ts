const CHARS_PER_WORD = 5;
const MS_PER_MINUTE = 60000;

export function grossWpm(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return chars / CHARS_PER_WORD / (ms / MS_PER_MINUTE);
}

export function firstStrokeAccuracy(correct: number, total: number): number {
  if (total <= 0) return 1;
  return correct / total;
}

export function cleanWpm(gross: number, accuracy: number): number {
  return gross * accuracy * accuracy;
}
