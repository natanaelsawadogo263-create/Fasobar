/**
 * Short FasoBar notification chime (Web Audio — no asset file).
 * Soft two-tone bell, similar to a message ping.
 */

let sharedContext: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) return null;

  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioCtx();
  }

  return sharedContext;
}

/** Call once after a user gesture so later chimes can autoplay. */
export function unlockNotificationAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume().then(() => {
    unlocked = true;
  });
}

function tone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/** Plays a discreet bell ping for a new admin activity notification. */
export async function playFasoBarNotificationChime(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
      unlocked = true;
    } catch {
      return;
    }
  }

  if (!unlocked && ctx.state !== "running") {
    return;
  }

  const now = ctx.currentTime;
  // Two-note chime (E6 → B5), soft and short.
  tone(ctx, 1318.5, now, 0.28, 0.09);
  tone(ctx, 987.8, now + 0.12, 0.38, 0.07);
}
