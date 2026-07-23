import fs from "node:fs/promises";
import path from "node:path";

const SCAN_TEMP_PATH = process.env.SCAN_TEMP_PATH || "/data/scan-temp";
const STALE_AFTER_MS = 10 * 60 * 1000;

// Rede de segurança pra requests que crasharam antes de apagar sua própria
// foto temporária (o caminho principal de limpeza é o `finally` da rota de
// scan). Chamada de forma não-bloqueante no início de cada request.
export async function sweepStaleScanTempFiles(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(SCAN_TEMP_PATH);
  } catch {
    return;
  }

  const now = Date.now();
  await Promise.all(
    entries.map(async (name) => {
      const filePath = path.join(SCAN_TEMP_PATH, name);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > STALE_AFTER_MS) {
          await fs.unlink(filePath);
        }
      } catch {
        // arquivo pode já ter sido removido por outro request concorrente
      }
    })
  );
}
