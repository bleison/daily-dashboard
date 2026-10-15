"use client";
import { useState } from "react";
type Item = { title: string; kind: string; completed_at: string | null; due_at?: string | null };
export default function DailySummary({ items }: { items: Item[] }) {
  const [speaking, setSpeaking] = useState(false);
  const open = items.filter(item => !item.completed_at && item.kind === "task");
  function speak() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const due = open.filter(item => item.due_at && new Date(item.due_at).toDateString() === new Date().toDateString()).length;
    const titles = open.slice(0, 5).map(item => item.title).join(". ");
    const text = open.length ? `Guten Tag. Du hast ${open.length} offene ${open.length === 1 ? "Aufgabe" : "Aufgaben"}${due ? `, davon ${due} heute fällig` : ""}. ${titles ? `Auf deiner Liste stehen: ${titles}.` : ""}` : "Guten Tag. Du hast keine offenen Aufgaben. Dein Kalender und das Wetter findest du weiter unten.";
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "de-CH"; utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false); setSpeaking(true); window.speechSynthesis.speak(utterance);
  }
  return <article className="card summary-card"><div><div className="section-kicker">Dein Überblick</div><h2>Guten Tag{open.length ? ` · ${open.length} offen` : " · bereit für den Tag"}</h2><p className="muted">{open.length ? `Deine nächste gute Aktion: ${open[0].title}` : "Ein ruhiger Start. Füge eine Aufgabe hinzu, wenn dir etwas einfällt."}</p></div><button className="btn secondary" onClick={speak} aria-pressed={speaking}>{speaking ? "Zusammenfassung stoppen" : "▶ Tagesübersicht anhören"}</button></article>;
}
