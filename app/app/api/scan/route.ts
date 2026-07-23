import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../lib/prisma";
import { rankCardsByOcrText, type MatchableCard } from "../../../lib/cardMatch";
import { sweepStaleScanTempFiles } from "../../../lib/scanTempCleanup";

const SCAN_TEMP_PATH = process.env.SCAN_TEMP_PATH || "/data/scan-temp";
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://ocr-service:5000";
const MAX_PHOTO_SIZE = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  sweepStaleScanTempFiles().catch(() => {});

  const formData = await req.formData().catch(() => null);
  const photo = formData?.get("photo");
  if (!formData || !(photo instanceof File)) {
    return NextResponse.json({ error: "Nenhuma foto enviada" }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_SIZE) {
    return NextResponse.json({ error: "Foto muito grande" }, { status: 400 });
  }

  const ext = photo.type === "image/png" ? ".png" : ".jpg";
  const containerPath = path.join(SCAN_TEMP_PATH, `${randomUUID()}${ext}`);

  await fs.mkdir(SCAN_TEMP_PATH, { recursive: true });
  await fs.writeFile(containerPath, Buffer.from(await photo.arrayBuffer()));

  let extractedText: string;
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePath: containerPath }),
    });
    const ocrBody = await ocrRes.json().catch(() => null);
    if (!ocrRes.ok || !ocrBody) {
      return NextResponse.json({ error: "Falha ao processar a imagem" }, { status: 502 });
    }
    extractedText = ocrBody.text ?? "";
  } catch {
    return NextResponse.json({ error: "Falha ao processar a imagem" }, { status: 502 });
  } finally {
    await fs.unlink(containerPath).catch(() => {});
  }

  const cards: MatchableCard[] = await prisma.card.findMany({
    select: {
      cardImageId: true,
      cardSetId: true,
      cardName: true,
      cardType: true,
      rarity: true,
      isParallel: true,
      sourceType: true,
      localImagePath: true,
    },
  });

  const candidates = rankCardsByOcrText(extractedText, cards);

  return NextResponse.json({ extractedText, candidates });
}
