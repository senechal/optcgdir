import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../../../lib/prisma";

const IMAGES_PATH = process.env.CATALOG_IMAGES_PATH || "/data/catalog-images";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Nunca sobrescreve o arquivo que já está em localImagePath: duas cartas
// (ex: uma alt art e a comum) podem estar apontando pro mesmo arquivo por
// engano — é exatamente o bug que essa página existe pra corrigir. Sempre
// grava num arquivo novo e exclusivo dessa carta, então editar uma nunca
// estraga a imagem de outra.
function manualFilename(cardImageId: string, ext: string): string {
  const safeId = cardImageId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeId}__manual${ext}`;
}

function extFromContentType(contentType: string | null): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  return ".jpg";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const cardImageId = form.get("cardImageId");
  if (typeof cardImageId !== "string" || !cardImageId) {
    return NextResponse.json({ error: "cardImageId é obrigatório" }, { status: 400 });
  }

  const card = await prisma.card.findUnique({ where: { cardImageId } });
  if (!card) {
    return NextResponse.json({ error: "Carta não encontrada" }, { status: 404 });
  }

  const file = form.get("file");
  const url = form.get("url");

  let buffer: Buffer;
  let ext: string;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo maior que 10MB" }, { status: 400 });
    }
    buffer = Buffer.from(await file.arrayBuffer());
    ext = path.extname(file.name).toLowerCase() || extFromContentType(file.type);
  } else if (typeof url === "string" && url.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Só URLs http/https" }, { status: 400 });
    }

    let res: Response;
    try {
      res = await fetch(parsed.toString());
    } catch {
      return NextResponse.json({ error: "Falha ao baixar a imagem" }, { status: 400 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Falha ao baixar a imagem: HTTP ${res.status}` }, { status: 400 });
    }

    buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Imagem maior que 10MB" }, { status: 400 });
    }
    ext = path.extname(parsed.pathname).toLowerCase() || extFromContentType(res.headers.get("content-type"));
  } else {
    return NextResponse.json({ error: "Envie um arquivo ou uma URL" }, { status: 400 });
  }

  if (!ALLOWED_EXT.has(ext)) ext = ".jpg";

  const filename = manualFilename(cardImageId, ext);
  await fs.mkdir(IMAGES_PATH, { recursive: true });
  await fs.writeFile(path.join(IMAGES_PATH, filename), buffer);

  await prisma.card.update({ where: { cardImageId }, data: { localImagePath: filename } });

  return NextResponse.json({ localImagePath: filename });
}
