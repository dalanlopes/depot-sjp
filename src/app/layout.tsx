import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Depot SJP - Gestão de Containers",
  description: "Sistema de Gestão para Depot de Containers - Estoque e Reparos",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
