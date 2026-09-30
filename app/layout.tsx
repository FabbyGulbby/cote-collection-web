import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cote Collection",
  description:
    "Consulte rapidement la cote d'un jeu grâce au Cerveau Collection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
