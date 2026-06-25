type AudioContextConstructor = new () => AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

const MASTER_GAIN = 0.18;
const HIT_BASE_FREQUENCY = 330;
const HIT_MAX_FREQUENCY = 1200;
const SEMITONE_RATIO = Math.pow(2, 1 / 12);
const MISS_FREQUENCY = 165;

export class ComboAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  resume(): void {
    if (!this.enabled) return;
    const context = this.ensureContext();
    if (context && context.state === 'suspended') {
      void context.resume();
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  hit(combo: number): void {
    const now = this.beginSound();
    if (!now) return;
    const { context, master, time } = now;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(this.comboFrequency(combo), time);

    const duration = 0.08;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(envelope).connect(master);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  /** A tiny, very short click layered under each correct keystroke — reads as a
   *  mechanical keyboard tap, reinforcing the "someone typing fast" disguise. */
  keyTap(): void {
    const now = this.beginSound();
    if (!now) return;
    const { context, master, time } = now;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1700, time);

    const duration = 0.025;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(0.18, time + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(envelope).connect(master);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  shatter(): void {
    const now = this.beginSound();
    if (!now) return;
    const { context, master, time } = now;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(660, time);
    oscillator.frequency.exponentialRampToValueAtTime(120, time + 0.07);

    const duration = 0.09;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(0.9, time + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(envelope).connect(master);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  /** A wrong key — a sharp, dissonant double-buzz that's impossible to miss,
   *  yet still reads as a stern "nope" rather than an arcade explosion. Two
   *  detuned sawtooth tones beat against each other for an unmistakable error. */
  miss(): void {
    const now = this.beginSound();
    if (!now) return;
    const { context, master, time } = now;
    const duration = 0.16;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    envelope.connect(master);

    for (const offset of [MISS_FREQUENCY, MISS_FREQUENCY * 1.06]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(offset, time);
      oscillator.frequency.exponentialRampToValueAtTime(offset * 0.6, time + duration);
      oscillator.connect(envelope);
      oscillator.start(time);
      oscillator.stop(time + duration);
    }
  }

  /** A heart is lost — a heavier descending buzz than a typo. */
  loseLife(): void {
    const now = this.beginSound();
    if (!now) return;
    const { context, master, time } = now;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(220, time);
    oscillator.frequency.exponentialRampToValueAtTime(70, time + 0.3);

    const duration = 0.34;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(envelope).connect(master);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  /** Game over — a short descending three-note "you died" motif. */
  death(): void {
    const now = this.beginSound();
    if (!now) return;
    const { context, master, time } = now;
    const notes = [196, 165, 110];
    const noteDuration = 0.22;
    notes.forEach((frequency, index) => {
      this.playDeathNote(context, master, frequency, time + index * noteDuration, noteDuration);
    });
  }

  private playDeathNote(
    context: AudioContext,
    master: GainNode,
    frequency: number,
    startTime: number,
    duration: number,
  ): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startTime);

    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(0.9, startTime + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(envelope).connect(master);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  private comboFrequency(combo: number): number {
    const steps = Math.max(0, combo);
    const frequency = HIT_BASE_FREQUENCY * Math.pow(SEMITONE_RATIO, steps);
    return Math.min(frequency, HIT_MAX_FREQUENCY);
  }

  private beginSound(): { context: AudioContext; master: GainNode; time: number } | null {
    if (!this.enabled) return null;
    const context = this.ensureContext();
    if (!context || !this.master) return null;
    return { context, master: this.master, time: context.currentTime };
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const Constructor = resolveAudioContextConstructor();
    if (!Constructor) return null;
    try {
      const context = new Constructor();
      const master = context.createGain();
      master.gain.setValueAtTime(MASTER_GAIN, context.currentTime);
      master.connect(context.destination);
      this.context = context;
      this.master = master;
      return context;
    } catch {
      return null;
    }
  }
}
