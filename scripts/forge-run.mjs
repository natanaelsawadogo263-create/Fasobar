import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const logPath = path.join(root, "forge-run.log");
const log = fs.createWriteStream(logPath, { flags: "w" });

function write(line) {
  log.write(line);
  process.stdout.write(line);
}

write(`[forge-run] cwd=${root}\n`);

const child = spawn("npx", ["electron-forge", "package"], {
  cwd: root,
  shell: true,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (buf) => write(buf.toString("utf8")));
child.stderr.on("data", (buf) => write(buf.toString("utf8")));

child.on("error", (err) => {
  write(`[forge-run] spawn error: ${err}\n`);
  process.exit(1);
});

child.on("close", (code) => {
  const exe = path.join(root, "out", "FasoBar-win32-x64", "FasoBar.exe");
  write(`[forge-run] exit=${code} exe=${fs.existsSync(exe)}\n`);
  log.end();
  process.exit(code === 0 && fs.existsSync(exe) ? 0 : 1);
});
