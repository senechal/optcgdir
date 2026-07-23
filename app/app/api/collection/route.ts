import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getDefaultUserId } from "../../../lib/currentUser";

type Action = "increment" | "decrement" | "toggleWantsTrade";

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = await req.json().catch(() => null);
  const cardImageId: string | undefined = body?.cardImageId;
  const action: Action | undefined = body?.action;

  if (!cardImageId || !action) {
    return NextResponse.json(
      { error: "cardImageId e action são obrigatórios" },
      { status: 400 }
    );
  }

  const existing = await prisma.collectionItem.findFirst({
    where: { cardImageId, userId, condition: null },
  });

  if (action === "increment") {
    if (existing) {
      await prisma.collectionItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: 1 } },
      });
    } else {
      await prisma.collectionItem.create({
        data: { cardImageId, userId, quantity: 1 },
      });
    }
  } else if (action === "decrement") {
    if (existing) {
      if (existing.quantity <= 1) {
        await prisma.collectionItem.delete({ where: { id: existing.id } });
      } else {
        await prisma.collectionItem.update({
          where: { id: existing.id },
          data: { quantity: { decrement: 1 } },
        });
      }
    }
    // Se não existe, não tem o que decrementar — ignora silenciosamente.
  } else if (action === "toggleWantsTrade") {
    if (existing) {
      await prisma.collectionItem.update({
        where: { id: existing.id },
        data: { wantsTrade: !existing.wantsTrade },
      });
    } else {
      await prisma.collectionItem.create({
        data: { cardImageId, userId, quantity: 0, wantsTrade: true },
      });
    }
  } else {
    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
