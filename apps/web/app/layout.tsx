import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Seller Agents AI | Inteligência comercial",
  description: "Operação comercial assistida por IA para moda infantil",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
