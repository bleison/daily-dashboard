"use client";
import { useState } from "react";
import { addItem, deleteItem, setDone } from "./actions";

type Item = { id: string; title: string; kind: string; completed_at: string | null; due_at: string | null; priority: string | null };
export function DailySummaryWidget({ items, onSpeak }: { items: Item[]; onSpeak: () => void }) {
  const [speaking, setSpeaking] = useState(false);
  const open = items.filter(item => !item.completed_at && item.kind === "task");
  const allTasks = items.filter(item => item.kind === "task");
  const doneToday = allTasks.filter(item => item.completed_at && new Date(item.completed_at).toDateString() === new Date().toDateString()).length;
  const progress = allTasks.length ? Math.round((allTasks.filter(item => item.completed_at).length / allTasks.length) * 100) : 0;
  function readSummary() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const text = open.length ? `Guten Tag. Du hast ${open.length} offene Aufgaben. Deine nächste gute Aktion: ${open[0].title}.` : "Guten Tag. Du hast keine offenen Aufgaben. Dein Tag ist bereit.";
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "de-CH"; utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false); setSpeaking(true); window.speechSynthesis.speak(utterance);
  }
  return <section className="overview-panel"><div className="section-kicker">Dein Überblick</div><div className="overview-line"><div><h2>{open.length ? `${open.length} Dinge auf deiner Liste` : "Platz für einen guten Tag"}</h2><p>{open.length ? `Als Nächstes: ${open[0].title}` : "Füge eine Aufgabe hinzu, wenn dir etwas einfällt."}</p></div><div className="overview-buttons"><button className="icon-action" type="button" onClick={readSummary} title="Tagesübersicht vorlesen">{speaking ? "■" : "▶"}</button><button className="icon-action mic-action" type="button" onClick={onSpeak} title="Aufgabe oder Termin sprechen">◉</button></div></div><div className="day-progress" aria-label={`${progress} Prozent der Aufgaben erledigt`}><span><i style={{width:`${progress}%`}}/></span><small>{doneToday ? `${doneToday} heute erledigt` : allTasks.length ? `${progress}% erledigt` : "Dein Tagesfortschritt"}</small></div></section>;
}

export function TasksWidget({ items, view }: { items: Item[]; view: string }) {
  const tasks = items.filter(item => item.kind === "task").slice(0, view === "focus" ? 1 : view === "compact" ? 8 : 5);
  const open = items.filter(item => item.kind === "task" && !item.completed_at).length;
  return <section className="tasks-panel"><div className="widget-section-title"><span className="section-kicker">Im Blick behalten</span><strong>{open} offen</strong></div>{view === "focus" ? <div className="focus-task">{tasks[0] ? <><small>Nächster Schritt</small><strong>{tasks[0].title}</strong></> : <p>Keine offenen Aufgaben.</p>}</div> : <ul className={`task-list ${view === "compact" ? "task-list-compact" : ""}`}>{tasks.map(item=><li key={item.id} className={item.completed_at ? "is-complete" : ""}><form action={setDone}><input type="hidden" name="id" value={item.id}/><button className="task-check" aria-label={item.completed_at ? "Erledigt" : `${item.title} abschliessen`} disabled={!!item.completed_at}>{item.completed_at ? "✓" : ""}</button></form><span className="task-title">{item.title}{item.due_at&&<small>{new Intl.DateTimeFormat("de-CH",{day:"numeric",month:"short"}).format(new Date(item.due_at))}</small>}</span><form action={deleteItem}><input type="hidden" name="id" value={item.id}/><button className="task-delete" aria-label="Aufgabe löschen">×</button></form></li>)}{!tasks.length&&<li className="empty-widget">Noch keine Aufgaben</li>}</ul>}
    <details className="widget-add"><summary>＋ Aufgabe hinzufügen</summary><form action={addItem} className="inline-add"><input name="title" aria-label="Neue Aufgabe" required maxLength={180} placeholder="Was möchtest du erledigen?"/><input type="hidden" name="kind" value="task"/><input type="hidden" name="priority" value="normal"/><button className="btn" aria-label="Aufgabe hinzufügen">＋</button></form></details>
  </section>;
}

