import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCardId } from "./cardHash.js";

function attrs(overrides) {
  return {
    cardName: "Kingdew",
    setId: "OP-17",
    cardSetId: "OP17-006",
    cardImageId: "OP17-006",
    cardImage: "https://optcgapi.com/media/static/Card_Images/OP17-006_a.jpg",
    ...overrides,
  };
}

test("is deterministic: mesmos atributos sempre geram o mesmo id", () => {
  assert.equal(computeCardId(attrs()), computeCardId(attrs()));
});

test("cartas com o mesmo card_image_id mas nome diferente (alt art) geram ids diferentes", () => {
  const base = computeCardId(attrs());
  const pandaman = computeCardId(
    attrs({ cardName: "Kingdew (Pandaman Art)", cardImage: "https://optcgapi.com/media/static/Card_Images/OP17-006_b.jpg" })
  );
  assert.notEqual(base, pandaman);
});

test("cartas com todos os outros campos iguais mas imagem diferente geram ids diferentes", () => {
  // Caso real: duas linhas "Gecko Moria - OP14-080" idênticas exceto a imagem.
  const a = computeCardId(attrs({ cardImage: "https://x/img-a.jpg" }));
  const b = computeCardId(attrs({ cardImage: "https://x/img-b.jpg" }));
  assert.notEqual(a, b);
});

test("um promo que reaproveita o card_image_id de uma carta de set gera um id diferente", () => {
  const setCard = computeCardId(attrs({ cardName: "Perona - OP14-033", setId: "OP14-EB04", cardSetId: "OP14-033", cardImageId: "OP14-033" }));
  const promo = computeCardId(
    attrs({
      cardName: "Perona (Extra Grand Battle for Stores 2026)",
      setId: "OP14",
      cardSetId: "OP14-033",
      cardImageId: "OP14-033",
      cardImage: "https://x/promo.jpg",
    })
  );
  assert.notEqual(setCard, promo);
});

test("trata a falta de imagem (null/undefined) de forma consistente", () => {
  assert.equal(computeCardId(attrs({ cardImage: null })), computeCardId(attrs({ cardImage: undefined })));
});

test("é sensível à ordem/conteúdo de cada campo (não só concatenação solta)", () => {
  const a = computeCardId({ cardName: "AB", setId: "C", cardSetId: "D", cardImageId: "E", cardImage: "" });
  const b = computeCardId({ cardName: "A", setId: "BC", cardSetId: "D", cardImageId: "E", cardImage: "" });
  assert.notEqual(a, b);
});

test("retorna um hex de 64 caracteres (sha256)", () => {
  const id = computeCardId(attrs());
  assert.match(id, /^[0-9a-f]{64}$/);
});
