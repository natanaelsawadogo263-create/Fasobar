/**
 * Sonnette FasoBar — AudioContext (fiable après un clic) + WAV chat.
 * Ne dépend pas d’un <audio muted> : c’est ce qui empêchait d’entendre.
 */

const CHIME_SRC = "/sounds/fasobar-notify.wav";
const CHIME_COOLDOWN_MS = 650;

let ctx: AudioContext | null = null;
let decodedBuffer: AudioBuffer | null = null;
let loadingBuffer = false;
let unlocked = false;
let lastPlayedAt = 0;

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

function voice(
  audioCtx: AudioContext,
  destination: AudioNode,
  frequency: number,
  type: OscillatorType,
  startAt: number,
  duration: number,
  peak: number,
) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

function playSynthBell(audioCtx: AudioContext) {
  const master = audioCtx.createGain();
  master.gain.value = 0.7;
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 8;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;
  master.connect(compressor);
  compressor.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  // Note 1 — corps
  voice(audioCtx, master, 830.6, "sine", now, 0.42, 0.28);
  voice(audioCtx, master, 830.6, "triangle", now, 0.28, 0.14);
  voice(audioCtx, master, 1661, "sine", now, 0.22, 0.08);
  // Note 2 — réponse type chat
  voice(audioCtx, master, 1318.5, "sine", now + 0.08, 0.48, 0.32);
  voice(audioCtx, master, 1318.5, "triangle", now + 0.08, 0.3, 0.12);
  voice(audioCtx, master, 1975.5, "sine", now + 0.15, 0.28, 0.07);
}

async function preloadWav(audioCtx: AudioContext) {
  if (decodedBuffer || loadingBuffer) return;
  loadingBuffer = true;
  try {
    const response = await fetch(CHIME_SRC, { cache: "force-cache" });
    if (!response.ok) return;
    const raw = await response.arrayBuffer();
    decodedBuffer = await audioCtx.decodeAudioData(raw.slice(0));
  } catch {
    decodedBuffer = null;
  } finally {
    loadingBuffer = false;
  }
}

function playDecoded(audioCtx: AudioContext) {
  if (!decodedBuffer) return false;
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  src.buffer = decodedBuffer;
  gain.gain.value = 1.15;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(0);
  return true;
}

/** À appeler dans le même tick qu’un clic / touche. */
export function unlockNotificationAudio(): void {
  const audioCtx = getAudioContext();
  if (!audioCtx) return;

  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }

  try {
    const buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
    unlocked = true;
  } catch {
    unlocked = audioCtx.state === "running";
  }

  void preloadWav(audioCtx);
}

/** Ping notification. `force` ignore le cooldown (ex. clic sur la cloche). */
export async function playFasoBarNotificationChime(
  options: { force?: boolean } = {},
): Promise<void> {
  const now = Date.now();
  if (!options.force && now - lastPlayedAt < CHIME_COOLDOWN_MS) return;

  const audioCtx = getAudioContext();
  if (!audioCtx) return;

  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      return;
    }
  }

  if (audioCtx.state !== "running" && !unlocked) {
    return;
  }

  lastPlayedAt = now;
  unlocked = true;

  if (!decodedBuffer) {
    void preloadWav(audioCtx);
  }

  if (!playDecoded(audioCtx)) {
    playSynthBell(audioCtx);
  }
}
