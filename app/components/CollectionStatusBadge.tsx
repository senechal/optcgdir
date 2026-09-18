// Indicador visual de status da coleção, sobreposto no canto da imagem da
// carta: cor conforme o quanto falta pro playset (1 pra coleção + 4 pra
// jogar = 5), e um "+" grudado no canto quando há cópias extras (essas
// sobras viram cartas de troca). Requer que o elemento pai tenha
// `position: relative` — este componente só se posiciona `absolute` dentro
// dele, sem afetar o layout do resto do card.
//
// Líder é um caso especial: um deck só usa 1 cópia do líder (não 4 como as
// outras cartas), então o playset completo dele é 1 pra coleção + 1 pra
// jogar = 2 — sem a faixa amarela intermediária, que não faz sentido
// quando só há um passo entre "tenho uma" e "tenho o playset".
const PLAYSET_COMPLETE_QUANTITY = 5;
const LEADER_PLAYSET_COMPLETE_QUANTITY = 2;

type Size = "md" | "sm";

const SIZES: Record<
  Size,
  {
    circle: number;
    border: number;
    offset: number;
    plus: number;
    plusRight: number;
    plusBottom: number;
  }
> = {
  md: { circle: 22, border: 2, offset: -6, plus: 16, plusRight: -8, plusBottom: -6 },
  sm: { circle: 14, border: 1, offset: -3, plus: 10, plusRight: -5, plusBottom: -4 },
};

export default function CollectionStatusBadge({
  quantity,
  cardType,
  size = "md",
}: {
  quantity: number;
  cardType: string;
  size?: Size;
}) {
  if (quantity <= 0) return null;

  const completeAt = cardType === "Leader" ? LEADER_PLAYSET_COMPLETE_QUANTITY : PLAYSET_COMPLETE_QUANTITY;
  const color =
    quantity === 1
      ? "var(--color-accent)"
      : quantity < completeAt
        ? "var(--color-warning)"
        : "var(--color-success)";
  const hasExtra = quantity > completeAt;
  const s = SIZES[size];

  return (
    <div
      data-testid="collection-status-badge"
      style={{
        position: "absolute",
        top: s.offset,
        right: s.offset,
        width: s.circle,
        height: s.circle,
        borderRadius: "50%",
        background: color,
        border: `${s.border}px solid var(--color-surface)`,
      }}
    >
      {hasExtra && (
        <svg
          data-testid="collection-status-badge-plus"
          width={s.plus}
          height={s.plus}
          viewBox="0 0 24 24"
          style={{ position: "absolute", right: s.plusRight, bottom: s.plusBottom }}
        >
          <circle cx="12" cy="12" r="11" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
          <path d="M12 6v12M6 12h12" stroke="var(--color-text-secondary)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
