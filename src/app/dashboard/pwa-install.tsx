"use client";
import { useEffect, useState } from "react";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export default function PwaInstall({compact=false}:{compact?:boolean}) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null); const [installed, setInstalled] = useState(false); const [help, setHelp] = useState(false);
  useEffect(() => { const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); }; const onInstall = () => setInstalled(true); window.addEventListener("beforeinstallprompt", onPrompt); window.addEventListener("appinstalled", onInstall); if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {}); return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstall); }; }, []);
  async function install() { if (!prompt) { setHelp(v => !v); return; } await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setInstalled(true); setPrompt(null); }
  return <><button type="button" className={`btn secondary pwa-install-btn${compact?" compact-install":""}`} onClick={install} aria-expanded={help}>{installed ? "App installiert" : "↧ App installieren"}</button>{help && <p className="muted install-help">iPhone/iPad: Teilen → «Zum Home-Bildschirm». Windows/Chrome: Browsermenü → «LifeOS installieren»; anschliessend im Startmenü an die Taskleiste anheften.</p>}</>;
}
