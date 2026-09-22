// Id estável de uma carta: hash de 5 atributos brutos da optcgapi.com. Como
// card_image_id sozinho não é único (a API reaproveita o mesmo valor pra
// variantes diferentes — ex: "Kingdew" e "Kingdew (Pandaman Art)" são ambas
// "OP17-006"), combinamos com o nome, o set e a URL da imagem: só colide se
// TUDO isso for idêntico, o que na prática só acontece quando é
// genuinamente a mesma carta repetida na resposta da API.
//
// Usado tanto pelo sync (catalog-sync/src/sync.js) quanto pela migração
// única que já rodou pra passar as cartas existentes pra esse esquema
// (catalog-sync/src/migrate-to-hash-ids.js) — os dois PRECISAM concordar
// nesse cálculo, senão a próxima sync depois da migração criaria cartas
// duplicadas em vez de atualizar as que já existem.
import crypto from "node:crypto";

export function computeCardId({ cardName, setId, cardSetId, cardImageId, cardImage }) {
  const raw = [cardName, setId, cardSetId, cardImageId, cardImage || ""].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}
