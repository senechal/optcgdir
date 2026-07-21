// Mantém o processo de pé e dispara src/sync.js no cron configurado.
// Usado só pelo serviço `catalog-sync-scheduler` (o serviço `catalog-sync`
// avulso roda sync.js direto e sai, via `docker compose run`).

import cron from "node-cron";
import { spawn } from "node:child_process";

const CRON_EXPR = process.env.SYNC_INTERVAL_CRON || "0 6 * * 1"; // segundas 06:00

function runSync() {
  console.log(`[scheduler] disparando sync incremental (${new Date().toISOString()})`);
  const child = spawn("node", ["src/sync.js"], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    console.log(`[scheduler] sync terminou com código ${code}`);
  });
}

console.log(`[scheduler] ativo, expressão cron: "${CRON_EXPR}"`);
cron.schedule(CRON_EXPR, runSync);

// Mantém o container vivo
process.stdin.resume();
