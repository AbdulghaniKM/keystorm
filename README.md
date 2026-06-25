# Keystorm

> A web-based typing roguelite where getting better at typing **is** the fun.

Words march toward your base. Type them to destroy them. The dungeon learns your weak keys and sends them back at you — get better, or get overrun.

---

## The idea

Most typing games fail one of two ways:

- **Drills** (typing.com, keybr) are honest vegetables — they train you but feel like homework.
- **Action games** (ZType) are honest candy — fun, but the words are random and never targeted at _your_ weaknesses, so your typing never actually improves.

Keystorm refuses to wrap a vegetable in candy. Instead it **dramatizes the skill curve**: the core feedback loop _is_ the unmistakable feeling of getting better — the same loop that makes practicing a guitar riff addictive. When "improving" is the reward, you don't need candy. The vegetable _is_ the candy.

**North star:** never reward a bad habit. Most action typing games reward raw speed, which trains players to peek at the keyboard and spray inaccurate bursts. Keystorm makes **accuracy and clean cadence** the thing that wins.

## Gameplay loop

A **typing roguelite**. Words spawn on the right and march toward your base on the left. Type the nearest word to shatter it. Let too many through and the run ends. Each run is ~10–15 minutes and ends on a clear verdict: _did I get better?_

Why roguelite over rhythm or narrative:

- Run-based structure is a difficulty curve in disguise, with a built-in improvement verdict.
- Enemies can secretly carry **your weak letter-pairs** — pedagogy disguised as menace ("the dungeon adapts to you").
- Lowest content cost: a word pool + procedural spawns = near-infinite play.
- It steals rhythm-typing's best property — **even cadence** — via the flow combo, without authoring music.

## The learning engine

What makes Keystorm actually _teach_:

1. **Weak-bigram targeting** — track per-**bigram** first-stroke error rate, not just single keys. Speed is bottlenecked by _transitions_ (`tion`, `br`, `ld`), not isolated letters. Bias word selection ~**70% mastered / 30% weak** so it challenges without punishing.
2. **Flow channel** — spawn rate and enemy speed scale with both elapsed time _and_ the player's current clean WPM, keeping them at the edge of their ability.
3. **Spaced repetition** _(planned)_ — fumbled words resurface soon, then at widening intervals once nailed. The biggest edge over action-typing games.
4. **Honest measurement** — **Clean WPM** = gross WPM × accuracy² (sloppy speed is mathematically punished); **first-stroke accuracy**, not "did it come out right after backspacing."
5. **No bad-habit reinforcement** — the **flow combo** rewards _even_ keystroke cadence; the erratic peek-find-stab pattern breaks it, so you can't game it by looking down.

## Progression & feel

- **See yourself improve:** a live keyboard heatmap that heals red → green as accuracy climbs, plus a post-run card showing most-improved and weakest bigrams.
- **Juice:** every correct key fires a rising-pitch tone (synthesized via Web Audio — no audio files) that climbs with the flow streak; a hot run literally sounds higher. Plus enemy shatter, screen shake, key-pops.
- **Meta progression** _(planned):_ unlock relics, enemy types, and biomes (numbers-row, punctuation, code-symbols) gated on **skill milestones**, not grind.
- **Daily warmup** _(planned):_ a 60–90s session targeting your current weak bigrams — the on-ramp and streak builder.

## MVP scope

**Hypothesis:** targeted, adaptive, juicy typing combat is more fun _and_ more effective than a drill — players improve on their weak bigrams without feeling like they practiced.

**Build first:** one combat screen · keystroke engine (per-key correctness + timing) · weak-bigram tracking + weighted word selection · clean-WPM + first-stroke-accuracy scoring · the juice · post-run card + heatmap.

**Cut for now:** relics/build variety, biomes, narrative, full spaced repetition, accounts, multiplayer, leaderboards.

**Gut-check:** if a playtester says "one more run" _and_ their weak bigrams measurably improve in one session — the hypothesis holds, and everything else is content.

**Audience:** designed for the widest funnel, with adaptive difficulty self-tuning to whoever plays — from improving beginners to intermediate typists (20–60 WPM). True absolute beginners (never learned home row) get a dedicated fundamentals mode later.

---

## Tech

Built on a Vue 3 + Vite foundation. Game state and the weakness vector persist to `localStorage`; no backend required for the MVP.

| Layer     | Technology                                      |
| --------- | ----------------------------------------------- |
| Framework | Vue 3.5 with `<script setup>` + Composition API |
| Styling   | Tailwind CSS v4 with CSS variable theming       |
| Language  | TypeScript 6 (strict)                           |
| Build     | Vite 8 (Rolldown)                               |
| State     | Pinia 3                                         |
| Rendering | Canvas 2D for the combat scene                  |
| Audio     | Web Audio API (synthesized combo tones)         |
| Linting   | [Oxlint](https://oxc.rs) + [Oxfmt](https://oxc.rs) |

## Quick start

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and set your values if needed:

```bash
cp .env.example .env
```

## Scripts

```bash
pnpm dev           # Start dev server
pnpm build         # Type-check + production build
pnpm preview       # Preview production build
pnpm lint          # Run Oxlint
pnpm lint:fix      # Oxlint with auto-fix
pnpm format        # Format with Oxfmt
pnpm format:check  # Check formatting (CI)
```

**Prerequisites:** Node.js 20.19+ or 22.12+, pnpm.

## License

MIT
