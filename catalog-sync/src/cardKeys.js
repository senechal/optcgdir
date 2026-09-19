// A optcgapi.com às vezes devolve variantes DIFERENTES da mesma carta com o
// mesmo `card_image_id` (ex: "Kingdew" e "Kingdew (Pandaman Art)" são ambas
// "OP17-006"). Como o banco usa card_image_id como chave primária, o upsert
// de uma sobrescrevia a outra e só a última sobrevivia. Aqui atribuímos uma
// chave única a cada variante dentro de uma mesma fonte (lista) da API.

export function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Nome do arquivo remoto sem extensão (ex: "OP17-006_W3SCXgC"). Único por
// imagem, então serve de nome local sem depender de qual carta "ganhou" o id.
function remoteFileStem(cardImage) {
  if (!cardImage) return null;
  try {
    const base = decodeURIComponent(new URL(cardImage).pathname.split("/").pop() ?? "");
    return base.replace(/\.[^.]+$/, "") || null;
  } catch {
    return null;
  }
}

// Devolve [{ raw, key, fileStem }] na ordem original.
// - key: valor a gravar como cardImageId.
// - fileStem: nome-base do arquivo local da imagem; null = usar a própria key.
//
// Regras pra ids repetidos:
// 1. Só ficam as entradas do MESMO set_id da última (mesma carta listada em
//    dois sets, ex: OP-04 e PRB-01, continua "última ganha" — o modelo só tem
//    um set por carta).
// 2. Entradas com a mesma imagem são a mesma carta repetida: fica a última.
// 3. Das restantes, a última mantém o id original (é a que já estava no
//    banco, então quantidades já registradas não mudam de carta); as demais
//    ganham "<id>__<slug do nome>".
export function assignCardKeys(cards) {
  const groups = new Map();
  cards.forEach((raw, index) => {
    if (!raw.card_image_id) return;
    if (!groups.has(raw.card_image_id)) groups.set(raw.card_image_id, []);
    groups.get(raw.card_image_id).push({ raw, index });
  });

  const result = [];
  for (const [id, entries] of groups) {
    if (entries.length === 1) {
      result.push({ ...entries[0], key: id, fileStem: null });
      continue;
    }

    const lastSet = entries[entries.length - 1].raw.set_id;
    const seenImages = new Set();
    const kept = [];
    for (const entry of [...entries].reverse()) {
      if (entry.raw.set_id !== lastSet) continue;
      const image = entry.raw.card_image ?? `no-image-${entry.index}`;
      if (seenImages.has(image)) continue;
      seenImages.add(image);
      kept.unshift(entry);
    }

    const usedKeys = new Set([id]);
    kept.forEach((entry, i) => {
      const isLast = i === kept.length - 1;
      let key = id;
      if (!isLast) {
        const base = `${id}__${slugify(entry.raw.card_name) || "variant"}`;
        key = base;
        for (let n = 2; usedKeys.has(key); n++) key = `${base}-${n}`;
      }
      usedKeys.add(key);
      result.push({ ...entry, key, fileStem: remoteFileStem(entry.raw.card_image) });
    });
  }

  return result.sort((a, b) => a.index - b.index).map(({ raw, key, fileStem }) => ({ raw, key, fileStem }));
}
