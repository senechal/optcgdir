import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Rodar vários workers em paralelo, cada um subindo seu próprio jsdom,
    // estava estourando o timeout de inicialização nesta máquina — 1
    // processo por vez é mais lento por arquivo, mas confiável.
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.config.{ts,js}",
        "**/node_modules/**",
        "**/.next/**",
        "**/prisma/**",
        "**/*.test.{ts,tsx}",
        "**/i18n/**",
        "app/layout.tsx",
        "next-env.d.ts",
        // Só instancia o PrismaClient (singleton) — sem lógica própria pra
        // testar; "testar" isso seria só verificar que `new PrismaClient()`
        // foi chamado, o que não valida nada de verdade.
        "lib/prisma.ts",
      ],
      // Lógica pura (sem I/O, sem framework) precisa bater 100% — é onde
      // testes valem mais e custam menos. O resto (componentes React,
      // rotas de API com Prisma/fetch, páginas de servidor) mira uma meta
      // realista em vez de 100% literal, que empurraria pra testes de
      // baixo valor só pra bater o número.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        "lib/cardMatch.ts": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        "lib/cardDisplay.ts": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
