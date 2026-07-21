export const metadata = {
  title: "OPTCG Collection Manager",
  description: "Gerenciador pessoal de coleção do One Piece Card Game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
