const MAX_FRAME_DELTA_MS = 50;

export function useGameLoop(tick: (dtMs: number) => void): {
  start: () => void;
  stop: () => void;
  running: Ref<boolean>;
} {
  const running = ref(false);
  let frameHandle = 0;
  let lastTime = 0;

  function step(now: number): void {
    if (!running.value) return;
    const dtMs = Math.min(now - lastTime, MAX_FRAME_DELTA_MS);
    lastTime = now;
    tick(dtMs);
    frameHandle = requestAnimationFrame(step);
  }

  function start(): void {
    if (running.value) return;
    running.value = true;
    lastTime = performance.now();
    frameHandle = requestAnimationFrame(step);
  }

  function stop(): void {
    if (!running.value) return;
    cancelAnimationFrame(frameHandle);
    running.value = false;
  }

  onUnmounted(stop);

  return { start, stop, running };
}
