"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Distância de pré-carregamento: começa a buscar a imagem bem antes dela
// entrar na viewport, pra em uso normal (scroll não-frenético) ela já
// estar pronta quando aparecer. Só scroll muito rápido ultrapassa essa
// margem e chega a ver o shimmer de loading.
const PRELOAD_MARGIN = "800px 0px";

const DEFAULT_SIZES = "(max-width: 480px) 45vw, (max-width: 900px) 25vw, (max-width: 1400px) 16vw, 150px";

// Verso genérico do card, usado sempre que a imagem real não carrega (404,
// falha de rede) — melhor que deixar um vazio sem explicação.
const FALLBACK_SRC = "/card-back-placeholder.png";

export default function CardImage({
  src,
  alt,
  objectFit = "cover",
  sizes = DEFAULT_SIZES,
}: {
  // null = catálogo não tem imagem pra essa carta (sem tentar carregar nada,
  // já mostra o verso genérico direto).
  src: string | null;
  alt: string;
  objectFit?: "cover" | "contain";
  sizes?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  const effectiveSrc = failed || !src ? FALLBACK_SRC : src;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: PRELOAD_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "63 / 88",
        borderRadius: 4,
        overflow: "hidden",
        background: "#eee",
      }}
    >
      {!loaded && <div className="card-shimmer" style={{ position: "absolute", inset: 0 }} />}
      {shouldLoad && (
        <Image
          src={effectiveSrc}
          alt={alt}
          fill
          sizes={sizes}
          style={{ objectFit, opacity: loaded ? 1 : 0, transition: "opacity 0.2s ease" }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      <style jsx global>{`
        .card-shimmer {
          background: linear-gradient(90deg, #eee 25%, #e2e2e2 37%, #eee 63%);
          background-size: 400% 100%;
          animation: card-shimmer-sweep 1.4s ease infinite;
        }
        @keyframes card-shimmer-sweep {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: 0 0;
          }
        }
      `}</style>
    </div>
  );
}
