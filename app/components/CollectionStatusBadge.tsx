// Indicador visual de status da coleção, sobreposto no canto da imagem da
// carta: cor conforme o quanto falta pro playset (1 pra coleção + 4 pra
// jogar = 5), e um "+" grudado no canto quando há cópias extras (essas
// sobras viram cartas de troca). Requer que o elemento pai tenha
// `position: relative` — este componente só se posiciona `absolute` dentro
// dele, sem afetar o layout do resto do card.
const PLAYSET_COMPLETE_QUANTITY = 5;

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
    font: number;
  }
> = {
  md: { circle: 22, border: 2, offset: -6, plus: 16, plusRight: -8, plusBottom: -6, font: 15 },
  sm: { circle: 14, border: 1, offset: -3, plus: 10, plusRight: -5, plusBottom: -4, font: 10 },
};

export default function CollectionStatusBadge({
  quantity,
  size = "md",
}: {
  quantity: number;
  size?: Size;
}) {
  if (quantity <= 0) return null;

  const color =
    quantity === 1
      ? "var(--color-accent)"
      : quantity < PLAYSET_COMPLETE_QUANTITY
        ? "var(--color-warning)"
        : "var(--color-success)";
  const hasExtra = quantity > PLAYSET_COMPLETE_QUANTITY;
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
        <span
          style={{
            position: "absolute",
            right: s.plusRight,
            bottom: s.plusBottom,
            width: s.plus,
            height: s.plus,
            borderRadius: "50%",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: s.font,
            fontWeight: 500,
            color: "var(--color-text-secondary)",
            lineHeight: 1,
          }}
        >
          +
        </span>
      )}
    </div>
  );
}
