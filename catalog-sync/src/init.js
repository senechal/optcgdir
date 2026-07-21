// Roda uma vez no boot do compose (serviço `init`), antes do `app` subir.
// Idempotente: pode rodar em todo restart sem duplicar trabalho.
//
// 1) Aplica o schema no Postgres (prisma db push) — seguro mesmo se já
//    estiver aplicado, só sincroniza o que mudou.
// 2) Só roda o seed inicial do catálogo (FULL_SYNC) se a tabela `cards`
//    ainda estiver vazia. Se já tiver dados, pula — quem mantém o catálogo
//    atualizado depois disso é o `catalog-sync-scheduler` (incremental).

import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

function run(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, { stdio: "inherit", env });
  if (result.status !== 0) {
    console.error(`[init] comando falhou: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

async function main() {
  console.log("[init] aplicando schema no banco (prisma db push)...");
  run("npx", ["prisma", "db", "push", "--skip-generate"]);

  const prisma = new PrismaClient();
  let cardCount = 0;
  try {
    cardCount = await prisma.card.count();
  } finally {
    await prisma.$disconnect();
  }

  if (cardCount > 0) {
    console.log(`[init] catálogo já tem ${cardCount} cartas — pulando seed inicial.`);
    return;
  }

  console.log("[init] catálogo vazio — rodando seed inicial completo (isso baixa todas as cartas + imagens, pode levar alguns minutos)...");
  run("node", ["src/sync.js"], { ...process.env, FULL_SYNC: "true" });
  console.log("[init] seed inicial concluído.");
}

main().catch((err) => {
  console.error("[init] erro fatal:", err);
  process.exit(1);
});
