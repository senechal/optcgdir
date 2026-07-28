import { test, expect } from "@playwright/test";

// Fixture seedada por e2e/seed.mjs (ver docker-compose.e2e.yml): 3 cartas
// determinísticas, sem depender do catálogo real.
const LUFFY = "Monkey.D.Luffy";
const ZORO = "Roronoa Zoro";
const NAMI = "Nami";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the seeded catalog on load", async ({ page }) => {
  await expect(page.getByText(LUFFY)).toBeVisible();
  await expect(page.getByText(ZORO)).toBeVisible();
  await expect(page.getByText(NAMI)).toBeVisible();
});

test("search by name filters the list", async ({ page }) => {
  await page.getByPlaceholder(/Buscar por nome/).fill("Zoro");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText(ZORO)).toBeVisible();
  await expect(page.getByText(LUFFY)).not.toBeVisible();
});

test("search by printed code filters to the exact card", async ({ page }) => {
  await page.getByPlaceholder(/Buscar por nome/).fill("OP01-003");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText(NAMI)).toBeVisible();
  await expect(page.getByText(ZORO)).not.toBeVisible();
});

test("color filter narrows results to the selected color", async ({ page }) => {
  await page.getByRole("button", { name: /Filtros/ }).click();
  await page.getByLabel("Cor: todas").selectOption("Blue");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText(NAMI)).toBeVisible();
  await expect(page.getByText(LUFFY)).not.toBeVisible();
  await expect(page.getByText(ZORO)).not.toBeVisible();
});

test("'Por Set' tab groups the catalog by set without filtering it", async ({ page }) => {
  await page.getByRole("tab", { name: "Por Set" }).click();
  await expect(page.getByRole("heading", { name: "OP-01" })).toBeVisible();
  await expect(page.getByText(LUFFY)).toBeVisible();
  await expect(page.getByText(ZORO)).toBeVisible();
});

test("adding a card to the collection surfaces it under 'Minha Coleção'", async ({ page }) => {
  const naniTile = page.locator(".card-tile", { hasText: NAMI });
  await naniTile.getByTitle("Adicionar 1").click();
  await expect(naniTile.getByText(/Qtd: 1/)).toBeVisible();

  await page.getByRole("tab", { name: "Minha Coleção" }).click();
  await expect(page.getByText(NAMI)).toBeVisible();
  await expect(page.getByText(LUFFY)).not.toBeVisible();
});

test("scanning a real card photo drives the search via the OCR pipeline", async ({ page }) => {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("fixtures/scan-luffy.jpg");

  // O OCR real não lê o código impresso com confiança (ver
  // memory/ocr_code_recognition_limitation.md) — o fallback por nome é o
  // caminho esperado aqui, então o aviso e o resultado devem refletir isso.
  await expect(page.getByText(/Identificando/)).toBeVisible();
  await expect(page.getByText(/Identificando/)).toBeHidden({ timeout: 20_000 });
  // .card-tile (não o texto do aviso, que também menciona o nome buscado)
  await expect(page.locator(".card-tile", { hasText: LUFFY })).toBeVisible();
});
