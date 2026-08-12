import os from "node:os";
import net from "node:net";

export function getLocalIPv4Addresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

export function getPreferredLanAddress(): string | null {
  const list = getLocalIPv4Addresses();
  const privatePreferred =
    list.find((ip) => ip.startsWith("192.168.")) ??
    list.find((ip) => ip.startsWith("10.")) ??
    list.find((ip) => {
      const second = Number(ip.split(".")[1] ?? 0);
      return ip.startsWith("172.") && second >= 16 && second <= 31;
    });
  return privatePreferred ?? list[0] ?? null;
}

export function isPortAvailable(port: number, host = "0.0.0.0"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export function buildLanServerUrl(port: number): string | null {
  const ip = getPreferredLanAddress();
  if (!ip) return null;
  return `http://${ip}:${port}`;
}
