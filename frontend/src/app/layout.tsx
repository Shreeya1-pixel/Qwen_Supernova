import type { Metadata, Viewport } from "next";
import { Amiri, Archivo, Bodoni_Moda, IBM_Plex_Mono, IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic, Parkinsans } from "next/font/google";
import "./globals.css";

const display = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});
const dash = Archivo({ variable: "--font-dash", subsets: ["latin"], axes: ["wdth"] });
const body = Parkinsans({ variable: "--font-body", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });
const arabic = Noto_Naskh_Arabic({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "600"] });
const arabicDisplay = Amiri({ variable: "--font-arabic-display", subsets: ["arabic"], weight: ["400", "700"], style: ["normal", "italic"] });
const arabicBody = IBM_Plex_Sans_Arabic({ variable: "--font-arabic-body", subsets: ["arabic"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "NABD نبض — the land's pulse, read before the body's",
  description:
    "Early warning for extreme and remote work in the UAE: live environmental stress, linked to the bodies exposed to it, acted on before harm.",
  openGraph: { locale: "en_AE", type: "website" },
};

export const viewport: Viewport = { themeColor: "#f2ebe0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${dash.variable} ${body.variable} ${mono.variable} ${arabic.variable} ${arabicDisplay.variable} ${arabicBody.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="grain">{children}</body>
    </html>
  );
}
