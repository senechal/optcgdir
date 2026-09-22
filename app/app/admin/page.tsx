import { getTranslations } from "next-intl/server";
import { prisma } from "../../lib/prisma";
import AdminCardImageEditor from "../../components/AdminCardImageEditor";

// Consulta o banco em tempo real — mesma razão do Dashboard (app/page.tsx).
export const dynamic = "force-dynamic";

const MAX_RESULTS = 60;

type SearchParams = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("Admin");
  const q = first(searchParams.q)?.trim() || "";

  const cards = q
    ? await prisma.card.findMany({
        where: {
          OR: [
            { cardName: { contains: q, mode: "insensitive" } },
            { cardImageId: { contains: q, mode: "insensitive" } },
            { cardSetId: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { cardSetId: "asc" },
        take: MAX_RESULTS,
      })
    : [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-4)", fontFamily: "var(--font-sans)" }}>
      <h1>{t("title")}</h1>
      <p style={{ color: "var(--color-text-secondary)" }}>{t("description")}</p>
      <p>
        <a href="/">{t("backToDashboard")}</a>
      </p>

      <form style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} style={{ flex: 1 }} />
        <button type="submit">{t("searchButton")}</button>
      </form>

      {q && cards.length === 0 && <p>{t("noResults")}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {cards.map((card) => (
          <AdminCardImageEditor
            key={card.cardImageId}
            cardImageId={card.cardImageId}
            cardName={card.cardName}
            cardSetId={card.cardSetId}
            localImagePath={card.localImagePath}
          />
        ))}
      </div>
    </div>
  );
}
