import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pádua FloodSim — Consulta hidrológica e cartográfica",
  description:
    "Plataforma acadêmica de consulta hidrológica e cenários oficiais de inundação do Rio Pomba em Santo Antônio de Pádua, RJ. Não substitui alertas oficiais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
