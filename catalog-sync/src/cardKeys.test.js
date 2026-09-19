import { test } from "node:test";
import assert from "node:assert/strict";
import { assignCardKeys, slugify } from "./cardKeys.js";

const img = (name) => `https://optcgapi.com/media/static/Card_Images/${name}`;
function raw(overrides) {
  return { card_image_id: "OP17-006", card_name: "Kingdew", set_id: "OP-17", card_image: img("OP17-006_a.jpg"), ...overrides };
}

test("slugify normaliza nomes de variante", () => {
  assert.equal(slugify("Kingdew (Pandaman Art)"), "kingdew-pandaman-art");
  assert.equal(slugify("  !!  "), "");
});

test("cartas sem colisão mantêm o id e o nome de arquivo padrão", () => {
  const out = assignCardKeys([raw({ card_image_id: "A-1" }), raw({ card_image_id: "A-2" })]);
  assert.deepEqual(out.map((o) => [o.key, o.fileStem]), [["A-1", null], ["A-2", null]]);
});

test("variantes com o mesmo id ficam as duas; a última mantém o id original", () => {
  const normal = raw({ card_name: "Kingdew", card_image: img("OP17-006_a.jpg") });
  const pandaman = raw({ card_name: "Kingdew (Pandaman Art)", card_image: img("OP17-006_b.jpg") });
  const out = assignCardKeys([normal, pandaman]);

  assert.equal(out.length, 2);
  assert.equal(out[0].raw, normal);
  assert.equal(out[0].key, "OP17-006__kingdew");
  assert.equal(out[1].raw, pandaman);
  assert.equal(out[1].key, "OP17-006");
});

test("cada variante colidida usa o nome do arquivo remoto (evita reaproveitar imagem antiga)", () => {
  const out = assignCardKeys([
    raw({ card_image: img("OP17-006_a.jpg") }),
    raw({ card_name: "Kingdew (Pandaman Art)", card_image: img("OP17-006_b.jpg") }),
  ]);
  assert.deepEqual(out.map((o) => o.fileStem), ["OP17-006_a", "OP17-006_b"]);
});

test("mesma carta repetida (mesma imagem) vira uma só", () => {
  const out = assignCardKeys([raw({}), raw({})]);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, "OP17-006");
});

test("mesmo id em sets diferentes: fica só a entrada do set da última (comportamento anterior)", () => {
  const inSet = raw({ card_image_id: "OP04-089", set_id: "OP-04", card_image: img("OP04-089_a.jpg") });
  const inPrb = raw({ card_image_id: "OP04-089", set_id: "PRB-01", card_image: img("OP04-089_b.jpg") });
  const out = assignCardKeys([inSet, inPrb]);
  assert.equal(out.length, 1);
  assert.equal(out[0].raw, inPrb);
  assert.equal(out[0].key, "OP04-089");
});

test("três variantes: as duas primeiras ganham sufixo, nomes iguais não colidem entre si", () => {
  const out = assignCardKeys([
    raw({ card_name: "Sword", card_image: img("x_1.jpg") }),
    raw({ card_name: "Sword", card_image: img("x_2.jpg") }),
    raw({ card_name: "Sword (Reprint)", card_image: img("x_3.jpg") }),
  ]);
  assert.deepEqual(out.map((o) => o.key), ["OP17-006__sword", "OP17-006__sword-2", "OP17-006"]);
  assert.equal(new Set(out.map((o) => o.key)).size, 3);
});

test("preserva a ordem original e ignora cartas sem card_image_id", () => {
  const out = assignCardKeys([raw({ card_image_id: "B-1" }), raw({ card_image_id: undefined }), raw({ card_image_id: "A-1" })]);
  assert.deepEqual(out.map((o) => o.key), ["B-1", "A-1"]);
});
