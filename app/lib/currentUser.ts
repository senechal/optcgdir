import { prisma } from "./prisma";

// Sem autenticação ainda (vem em etapa futura). Enquanto isso, todo mundo
// que acessa o app "é" esse único usuário padrão, criado automaticamente
// na primeira vez que alguém mexe na coleção.
let cachedUserId: string | null = null;

export async function getDefaultUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const existing = await prisma.user.findFirst();
  if (existing) {
    cachedUserId = existing.id;
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      username: "default",
      passwordHash: "no-auth-yet",
    },
  });
  cachedUserId = created.id;
  return created.id;
}
