import { defineConfig, devices } from "@playwright/test";

// Roda contra a stack real via docker-compose (app + db + ocr-service),
// não contra mocks — é o ponto do E2E: validar o fluxo completo (scan de
// verdade passando pelo OCR, Postgres de verdade) sem gastar tokens numa
// sessão de navegador manual pra cada mudança.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Sobe a stack completa via docker-compose antes de rodar os testes.
  // `-p optcgdir-e2e` isola rede/volumes do projeto de dev local (que já
  // roda com o nome padrão "optcgdir"); porta 3010 e container_name
  // próprios (docker-compose.e2e.yml) evitam colidir com os containers de
  // dev já de pé. `reuseExistingServer` deixa rodar contra uma stack E2E
  // já de pé em dev local, sem rebuildar toda vez.
  webServer: {
    command:
      "docker compose -p optcgdir-e2e -f ../docker-compose.yml -f ../docker-compose.e2e.yml --env-file ../.env.e2e up --build -d --wait app ocr-service",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
