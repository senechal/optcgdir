import { prisma } from "../lib/prisma";

// Essa página consulta o banco em tempo real — não pode ser pré-renderizada
// no `next build` (não há Postgres disponível durante o build da imagem).
export const dynamic = "force-dynamic";

export default async function Home() {
  const totalCards = await prisma.card.count();
  const totalSets = await prisma.set.count();

  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>OPTCG Collection Manager</h1>
      <p>Infraestrutura base funcionando 🎉</p>
      <p>
        Catálogo sincronizado: <strong>{totalCards}</strong> cartas em{" "}
        <strong>{totalSets}</strong> sets.
      </p>
      <p style={{ color: "#888" }}>
        Dashboard com filtros, busca e grid vem na próxima etapa.
      </p>
    </main>
  );
}
