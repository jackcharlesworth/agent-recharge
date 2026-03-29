import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const roboto = Roboto({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agent Wallet",
  description: "Fund AI agent wallets across any chain with LayerZero",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
