/**
 * Génère un ping type chat (cloche verre, deux notes) — 44.1 kHz stéréo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 44100;
const duration = 0.62;
const channels = 2;
const samples = Math.floor(sampleRate * duration);

function envelope(local, attack, decay) {
  if (local < 0) return 0;
  const a = Math.min(1, local / attack);
  return a * Math.exp(-local * decay);
}

function bell(local, f0, gain) {
  if (local < 0) return 0;
  const env = envelope(local, 0.006, 7.2);
  const partials = [
    [1.0, 1.0],
    [2.004, 0.42],
    [2.997, 0.2],
    [4.08, 0.11],
    [5.41, 0.07],
    [6.79, 0.035],
  ];
  let s = 0;
  for (const [ratio, amp] of partials) {
    s += Math.sin(2 * Math.PI * f0 * ratio * local) * amp;
  }
  const mod = Math.sin(2 * Math.PI * f0 * 2.15 * local) * 0.22 * Math.exp(-local * 14);
  s += Math.sin(2 * Math.PI * f0 * local + mod) * 0.28;
  return s * env * gain;
}

function body(local) {
  if (local < 0 || local > 0.09) return 0;
  const env = envelope(local, 0.004, 38);
  return Math.sin(2 * Math.PI * 196 * local) * env * 0.22;
}

const left = new Float64Array(samples);
const right = new Float64Array(samples);

for (let i = 0; i < samples; i += 1) {
  const t = i / sampleRate;
  // Deux notes montantes (sol#5 → mi6), intervalle de message.
  const note1L = bell(t, 830.6 * 0.998, 0.72);
  const note1R = bell(t, 830.6 * 1.002, 0.72);
  const note2L = bell(t - 0.078, 1318.5 * 0.997, 0.86);
  const note2R = bell(t - 0.078, 1318.5 * 1.003, 0.86);
  const sparkleL = bell(t - 0.15, 1975.5 * 0.996, 0.22);
  const sparkleR = bell(t - 0.15, 1975.5 * 1.004, 0.22);
  const thud = body(t);

  left[i] = thud * 0.9 + note1L + note2L + sparkleL;
  right[i] = thud * 1.1 + note1R + note2R + sparkleR;
}

let peak = 0;
for (let i = 0; i < samples; i += 1) {
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const norm = peak > 0 ? 0.86 / peak : 1;

const dataSize = samples * channels * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * 2, 28);
buffer.writeUInt16LE(channels * 2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < samples; i += 1) {
  buffer.writeInt16LE(Math.round(left[i] * norm * 32767), offset);
  buffer.writeInt16LE(Math.round(right[i] * norm * 32767), offset + 2);
  offset += 4;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "fasobar-notify.wav");
writeFileSync(outFile, buffer);
console.log(`Wrote ${outFile} (${buffer.length} bytes)`);
