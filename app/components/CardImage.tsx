"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Distância de pré-carregamento: começa a buscar a imagem bem antes dela
// entrar na viewport, pra em uso normal (scroll não-frenético) ela já
// estar pronta quando aparecer. Só scroll muito rápido ultrapassa essa
// margem e chega a ver o shimmer de loading.
const PRELOAD_MARGIN = "800px 0px";

export default function CardImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 480px) 45vw, (max-width: 900px) 25vw, (max-width: 1400px) 16vw, 150px"
          style={{ objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity 0.2s ease" }}
          onLoad={() => setLoaded(true)}
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
