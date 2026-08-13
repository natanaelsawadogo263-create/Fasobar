/**
 * Sonnette FasoBar : WAV généré + un seul HTMLAudioElement.
 * Le même élément sert au déblocage (geste utilisateur) et à la lecture.
 */

let chimeSrc: string | null = null;
let unlocked = false;
let lastPlayedAt = 0;
let sharedAudio: HTMLAudioElement | null = null;

const CHIME_COOLDOWN_MS = 600;

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function createChimeDataUri(): string {
  const sampleRate = 22050;
  const duration = 0.42;
  const samples = Math.floor(sampleRate * duration);
  const dataSize = samples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 0.012) * Math.max(0, 1 - t / 0.38);
    const a = Math.sin(2 * Math.PI * 1046.5 * t) * 0.55;
    const b = Math.sin(2 * Math.PI * 1568 * t) * (t > 0.12 ? 0.4 : 0);
    const sample = (a + b) * env;
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clipped * 0.92 * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function getChimeSrc(): string {
  if (!chimeSrc) {
    chimeSrc = createChimeDataUri();
  }
  return chimeSrc;
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(getChimeSrc());
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.9;
  }
  return sharedAudio;
}

/** À appeler sur un geste utilisateur (clic / touche) pour autoriser le son. */
export function unlockNotificationAudio(): void {
  const audio = getSharedAudio();
  if (!audio) return;

  audio.muted = true;
  const play = audio.play();
  if (play && typeof play.then === "function") {
    void play
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        unlocked = true;
      })
      .catch(() => {
        audio.muted = false;
      });
  } else {
    audio.muted = false;
    unlocked = true;
  }
}

/** Ping pour une nouvelle notification / un nouveau ticket. */
export async function playFasoBarNotificationChime(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayedAt < CHIME_COOLDOWN_MS) return;

  const audio = getSharedAudio();
  if (!audio) return;

  lastPlayedAt = now;
  audio.muted = false;
  audio.volume = 0.9;
  try {
    audio.currentTime = 0;
  } catch {
    // Safari peut jeter si pas encore chargé.
  }

  try {
    await audio.play();
    unlocked = true;
  } catch {
    if (!unlocked) {
      lastPlayedAt = 0;
    }
  }
}
