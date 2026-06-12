import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "H2H ARCHIVE — Mundial 2026",
  description: "Typuj wyniki MŚ 2026 i śledź historię każdego starcia. 72 pary, 12 grup, 48 drużyn.",
  openGraph: {
    title: "H2H ARCHIVE — Mundial 2026",
    description: "Typuj wyniki. Śledź historię. Walcz o ranking.",
    siteName: "H2H Archive",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${bebasNeue.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
