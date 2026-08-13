/**
 * Sonnette FasoBar — ping type chat (fichier WAV stéréo).
 * Le même élément audio sert au déblocage (geste) et à la lecture.
 */

const CHIME_SRC = "/sounds/fasobar-notify.wav";
const CHIME_COOLDOWN_MS = 700;

let unlocked = false;
let lastPlayedAt = 0;
let sharedAudio: HTMLAudioElement | null = null;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(CHIME_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.92;
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
  audio.volume = 0.92;
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
