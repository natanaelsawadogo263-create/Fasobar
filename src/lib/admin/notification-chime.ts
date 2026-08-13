/**
 * Notification FasoBar — son « span » (pop message).
 * Lecture HTMLAudio + AudioContext pour passer l’autoplay après un clic.
 */

const CHIME_SRC = "/sounds/span.mp3";
const CHIME_COOLDOWN_MS = 500;

let unlocked = false;
let lastPlayedAt = 0;
let sharedAudio: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let decodedBuffer: AudioBuffer | null = null;
let loadingBuffer = false;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(CHIME_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 1;
  }
  return sharedAudio;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx || ctx.state === "closed") {
    ctx = new AC();
  }
  return ctx;
}

async function preloadBuffer(audioCtx: AudioContext) {
  if (decodedBuffer || loadingBuffer) return;
  loadingBuffer = true;
  try {
    const response = await fetch(CHIME_SRC, { cache: "force-cache" });
    if (!response.ok) return;
    decodedBuffer = await audioCtx.decodeAudioData((await response.arrayBuffer()).slice(0));
  } catch {
    decodedBuffer = null;
  } finally {
    loadingBuffer = false;
  }
}

function playDecoded(audioCtx: AudioContext): boolean {
  if (!decodedBuffer) return false;
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  src.buffer = decodedBuffer;
  gain.gain.value = 1.2;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(0);
  return true;
}

/** À appeler dans le même tick qu’un clic / touche. */
export function unlockNotificationAudio(): void {
  const audio = getSharedAudio();
  const audioCtx = getAudioContext();

  if (audioCtx) {
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    void preloadBuffer(audioCtx);
  }

  if (!audio) return;
  audio.muted = false;
  audio.load();
  unlocked = true;
}

/** Joue le son span. `force` ignore le cooldown (clic sur la cloche). */
export async function playFasoBarNotificationChime(
  options: { force?: boolean } = {},
): Promise<void> {
  const now = Date.now();
  if (!options.force && now - lastPlayedAt < CHIME_COOLDOWN_MS) return;
  lastPlayedAt = now;

  const audioCtx = getAudioContext();
  if (audioCtx?.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      // continue vers HTMLAudio
    }
  }

  if (audioCtx && playDecoded(audioCtx)) {
    unlocked = true;
    return;
  }

  const audio = getSharedAudio();
  if (!audio) return;

  audio.muted = false;
  audio.volume = 1;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // Safari
  }

  try {
    const clone = audio.cloneNode(true) as HTMLAudioElement;
    clone.volume = 1;
    clone.muted = false;
    await clone.play();
    unlocked = true;
    return;
  } catch {
    // clone bloqué
  }

  try {
    await audio.play();
    unlocked = true;
  } catch {
    if (!unlocked) {
      lastPlayedAt = 0;
    }
    if (audioCtx) {
      void preloadBuffer(audioCtx);
    }
  }
}
