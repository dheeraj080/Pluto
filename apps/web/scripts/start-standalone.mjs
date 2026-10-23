import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Start the production standalone server locally.
 *
 * `next start` does not support `output: "standalone"`, and the standalone
 * bundle intentionally excludes `.next/static` and `public` (the Dockerfile
 * copies them in). This script mirrors those copies before spawning the server
 * so `npm start` behaves the same way locally as it does in the container.
 */

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = join(appDir, ".next", "standalone", "apps", "web");
const serverEntry = join(standaloneDir, "server.js");

if (!existsSync(serverEntry)) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}

const copies = [
  [join(appDir, ".next", "static"), join(standaloneDir, ".next", "static")],
  [join(appDir, "public"), join(standaloneDir, "public")],
];

for (const [from, to] of copies) {
  if (!existsSync(from)) continue;
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: process.env.PORT ?? "3001",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
