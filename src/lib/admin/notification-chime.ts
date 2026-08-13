/**
 * Sonnette FasoBar (Web Audio — pas de fichier).
 * Deux notes courtes, type « ping » de message.
 */

let sharedContext: AudioContext | null = null;
let unlocked = false;
let lastPlayedAt = 0;

const CHIME_COOLDOWN_MS = 450;

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

function playSilentUnlock(ctx: AudioContext) {
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore — unlock is best-effort.
  }
}

/** À appeler sur un geste utilisateur pour autoriser le son ensuite. */
export function unlockNotificationAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  void ctx.resume().then(() => {
    unlocked = true;
    playSilentUnlock(ctx);
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
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/** Ping discret pour une nouvelle notification / un nouveau ticket. */
export async function playFasoBarNotificationChime(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastPlayedAt < CHIME_COOLDOWN_MS) return;

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

  if (ctx.state !== "running" && !unlocked) {
    return;
  }

  lastPlayedAt = nowMs;
  const now = ctx.currentTime;
  tone(ctx, 1318.5, now, 0.26, 0.14);
  tone(ctx, 987.8, now + 0.11, 0.36, 0.11);
}
