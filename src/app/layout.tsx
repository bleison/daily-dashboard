import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "LifeOS — Dein persönliches Dashboard", description: "Aufgaben, Kalender, Wetter und Tagesplanung an einem Ort.", manifest: "/manifest.webmanifest", icons: { icon: "/lifeos-icon.svg", apple: "/lifeos-icon.svg" }, appleWebApp: { capable: true, title: "LifeOS", statusBarStyle: "default" } };
export const viewport: Viewport = { themeColor: "#126a50" };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="de"><body>{children}</body></html>; }
