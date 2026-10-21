"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { addItem, saveDashboardLayout } from "./actions";
import { defaultDashboardLayout, dashboardColumns, dashboardRows, widgetTitles, widgetSizes, type WidgetLayout, type WidgetId, type WidgetColor, type WidgetView } from "./layout-model";
import { DailySummaryWidget, TasksWidget } from "./dashboard-widgets";
import CalendarWidget from "./calendar-widget";
import AppleCalendarWidget from "./apple-calendar-widget";
import WeatherWidget from "./weather-widget";
import { signOut } from "@/app/auth-actions";
import PwaInstall from "./pwa-install";

type Item = { id: string; title: string; kind: string; completed_at: string | null; created_at: string; due_at: string | null; priority: string | null };
type LocalEvent = { id: string; title: string; starts_at: string; ends_at: string };
type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<SpeechRecognitionResult>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void;
};
type SpeechRecognitionWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
type VoiceDraft = { kind: "task" | "event"; title: string; date: string; time: string };
type DragState = { id: WidgetId; mode: "move" | "resize"; startX: number; startY: number; cellW: number; cellH: number; before: WidgetLayout[]; item: WidgetLayout };
const colors: { id: WidgetColor; name: string }[] = [{ id: "mint", name: "Mint" }, { id: "blue", name: "Blau" }, { id: "lavender", name: "Lavendel" }, { id: "peach", name: "Apricot" }, { id: "butter", name: "Butter" }, { id: "white", name: "Weiss" }];

function overlaps(a: WidgetLayout, b: WidgetLayout) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function localDateOffset(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function parseVoice(text: string): VoiceDraft {
  let rest = text.trim();
  const kind = /\b(termin|treffen|meeting|arzt|zahnarzt|gespräch|call)\b/i.test(rest) ? "event" : "task";
  let date = localDateOffset(0);
  if (/\bmorgen\b/i.test(rest)) { date = localDateOffset(1); rest = rest.replace(/\bmorgen\b/i, " "); }
  else if (/\bheute\b/i.test(rest)) rest = rest.replace(/\bheute\b/i, " ");
  const afterDays = rest.match(/\bin\s+(\d+)\s+tagen?\b/i);
  if (afterDays) { date = localDateOffset(Math.min(365, Number(afterDays[1]))); rest = rest.replace(afterDays[0], " "); }
  const writtenDate = rest.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (writtenDate) { const year = writtenDate[3] ? Number(writtenDate[3].length === 2 ? `20${writtenDate[3]}` : writtenDate[3]) : new Date().getFullYear(); date = `${year}-${String(Number(writtenDate[2])).padStart(2, "0")}-${String(Number(writtenDate[1])).padStart(2, "0")}`; rest = rest.replace(writtenDate[0], " "); }
  const timeMatch = rest.match(/\b(?:um\s*)?(\d{1,2})(?::(\d{2}))?\s*uhr\b/i) || rest.match(/\bum\s*(\d{1,2})(?::(\d{2}))?\b/i);
  const time = timeMatch ? `${String(Math.min(23, Number(timeMatch[1]))).padStart(2, "0")}:${String(Math.min(59, Number(timeMatch[2] || 0))).padStart(2, "0")}` : "09:00";
  if (timeMatch) rest = rest.replace(timeMatch[0], " ");
  const title = rest.replace(/\b(erstelle|erstell|mach|plane|bitte|einen|eine|ein|termin|aufgabe|task|für mich|erinnere mich an)\b/gi, " ").replace(/\s+/g, " ").trim();
  return { kind, title: title || text.trim(), date, time };
}

export default function DashboardCanvas({ items, events, savedLayout }: { items: Item[]; events: LocalEvent[]; savedLayout?: WidgetLayout[] | null }) {
  const [layout, setLayout] = useState<WidgetLayout[]>(savedLayout?.length ? savedLayout : defaultDashboardLayout);
  const layoutRef = useRef(layout); layoutRef.current = layout;
  const dragRef = useRef<DragState | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [dropPreview, setDropPreview] = useState<WidgetLayout | null>(null);
  const [saveState, setSaveState] = useState("Gespeichert");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceCommand, setVoiceCommand] = useState("");
  const [mobileWidget, setMobileWidget] = useState<WidgetId>(layout[0]?.id || "overview");

  async function persist(next: WidgetLayout[]) {
    setSaveState("Speichert …");
    const result = await saveDashboardLayout(next);
    setSaveState(result.ok ? "Gespeichert" : result.error || "Speichern fehlgeschlagen");
  }
  function updateLayout(next: WidgetLayout[]) { layoutRef.current = next; setLayout(next); }
  function startDrag(event: ReactPointerEvent, item: WidgetLayout, mode: "move" | "resize") {
    if ((event.target as HTMLElement).closest("button:not(.resize-handle),select,input,summary,a")) return;
    const board = event.currentTarget.closest(".dashboard-canvas") as HTMLElement | null;
    if (!board) return;
    event.preventDefault();
    const rect = board.getBoundingClientRect();
    const style = getComputedStyle(board);
    const gapX = Number.parseFloat(style.columnGap) || 0;
    const gapY = Number.parseFloat(style.rowGap) || 0;
    dragRef.current = { id: item.id, mode, startX: event.clientX, startY: event.clientY, cellW: (rect.width - gapX * (dashboardColumns - 1)) / dashboardColumns + gapX, cellH: (rect.height - gapY * (dashboardRows - 1)) / dashboardRows + gapY, before: layoutRef.current, item };
    setDragging(item.id);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current; if (!drag) return;
      const dx = Math.round((event.clientX - drag.startX) / drag.cellW), dy = Math.round((event.clientY - drag.startY) / drag.cellH);
      const wanted = drag.mode === "move"
        ? { ...drag.item, x: Math.max(0, Math.min(dashboardColumns - drag.item.w, drag.item.x + dx)), y: Math.max(0, Math.min(dashboardRows - drag.item.h, drag.item.y + dy)) }
        : { ...drag.item, w: Math.max(2, Math.min(dashboardColumns - drag.item.x, drag.item.w + dx)), h: Math.max(2, Math.min(dashboardRows - drag.item.y, drag.item.h + dy)) };
      const others = drag.before.filter(item => item.id !== drag.id);
      let nextItem = wanted;
      if (drag.mode === "move" && others.some(item => overlaps(wanted, item))) {
        const candidates: WidgetLayout[] = [];
        for (let y = 0; y <= dashboardRows - wanted.h; y++) for (let x = 0; x <= dashboardColumns - wanted.w; x++) {
          const candidate = { ...wanted, x, y };
          if (others.every(item => !overlaps(candidate, item))) candidates.push(candidate);
        }
        nextItem = candidates.sort((a,b) => (Math.abs(a.x-wanted.x)+Math.abs(a.y-wanted.y))-(Math.abs(b.x-wanted.x)+Math.abs(b.y-wanted.y)))[0] || drag.item;
      } else if (drag.mode === "resize" && others.some(item => overlaps(wanted, item))) nextItem = drag.item;
      setDropPreview(nextItem);
      updateLayout(drag.before.map(item => item.id === drag.id ? nextItem : item));
    };
    const finish = () => {
      const drag = dragRef.current; if (!drag) return;
      dragRef.current = null; setDragging(null); setDropPreview(null);
      const next = layoutRef.current; const moved = next.find(item => item.id === drag.id);
      if (!moved || next.some(item => item.id !== drag.id && overlaps(moved, item))) { updateLayout(drag.before); setSaveState("Blöcke dürfen sich nicht überdecken"); return; }
      void persist(next);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", finish);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish); };
  }, []);

  function beginVoice() {
    setVoiceOpen(true); setVoiceMessage("");
    if (voiceBusy && recognitionRef.current) { recognitionRef.current.stop(); setVoiceBusy(false); return; }
    const Speech = (window as SpeechRecognitionWindow).SpeechRecognition || (window as SpeechRecognitionWindow).webkitSpeechRecognition;
    if (!Speech) { setVoiceSupported(false); setVoiceMessage("Firefox bietet die eingebaute Web-Spracherkennung nicht standardmässig an. Nutze das Windows-Diktat: Befehlsfeld anklicken, Windows-Taste + H drücken und sprechen."); return; }
    setVoiceSupported(true);
    const recognition = new Speech(); recognitionRef.current = recognition; recognition.lang = "de-CH"; recognition.interimResults = false; recognition.maxAlternatives = 1; setVoiceBusy(true);
    recognition.onresult = event => { const transcript = event.results[0]?.[0]?.transcript || ""; setVoiceCommand(transcript); setVoiceDraft(parseVoice(transcript)); setVoiceMessage(`Erkannt: „${transcript}“ — bitte vor dem Speichern prüfen.`); };
    recognition.onerror = event => { setVoiceMessage(event.error === "not-allowed" ? "Mikrofonzugriff wurde nicht erlaubt." : "Spracherkennung fehlgeschlagen. Du kannst den Text auch eintippen."); setVoiceBusy(false); };
    recognition.onend = () => { setVoiceBusy(false); recognitionRef.current = null; };
    try { recognition.start(); } catch { setVoiceBusy(false); setVoiceMessage("Mikrofon konnte nicht gestartet werden. Du kannst den Text eintippen."); }
  }
  function closeVoice() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceBusy(false);
    setVoiceOpen(false);
  }
  function resetLayout() {
    updateLayout(defaultDashboardLayout);
    setMobileWidget("overview");
    void persist(defaultDashboardLayout);
  }
  async function saveVoiceDraft(form: HTMLFormElement) {
    const data = new FormData(form); const title = String(data.get("title") || "").trim(); if (!title) return;
    try {
    if (voiceDraft?.kind === "event") {
      const startsAt = String(data.get("date") || "") + "T" + String(data.get("time") || "09:00");
      const start = new Date(startsAt); const end = new Date(start.getTime() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      data.set("startsAt", `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`);
      data.set("endsAt", `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`);
      data.set("title", title);
      data.set("timezoneOffset", String(new Date().getTimezoneOffset()));
      const { createCalendarEvent } = await import("./actions"); const result = await createCalendarEvent(data);
      setVoiceMessage(result.ok ? "Termin im LifeOS-Kalender gespeichert." : result.error || "Speichern fehlgeschlagen.");
      if (result.ok) { setVoiceDraft(null); setVoiceOpen(false); window.location.reload(); }
    } else {
      data.set("kind", "task"); data.set("priority", "normal"); data.set("dueAt", String(data.get("date") || ""));
      await addItem(data); setVoiceMessage("Aufgabe gespeichert."); setVoiceDraft(null); setVoiceOpen(false); window.location.reload();
    }
    } catch { setVoiceMessage("Speichern ist fehlgeschlagen. Bitte prüfe deine Verbindung und versuche es erneut."); }
  }

  function findFreePosition(widget: WidgetId) {
    const size = widgetSizes[widget];
    const template = { id: widget, x: 0, y: 0, ...size, color: "white" as WidgetColor, view: "standard" as WidgetView };
    for (let y = 0; y <= dashboardRows - template.h; y++) for (let x = 0; x <= dashboardColumns - template.w; x++) {
      const candidate = { ...template, x, y };
      if (layoutRef.current.every(item => !overlaps(candidate, item))) return candidate;
    }
    return null;
  }
  const visibleIds = new Set(layout.map(item => item.id));
  const missingIds = (Object.keys(widgetTitles) as WidgetId[]).filter(id => !visibleIds.has(id));
  return <>
    <main className="dashboard-screen">
      <header className="dashboard-bar"><a className="brand" href="/dashboard"><span className="brand-mark" aria-hidden="true">✳</span>lifeos</a><div className="dashboard-bar-title"><strong>Dein Tag, dein Layout</strong><span>{saveState}</span></div><div className="dashboard-actions"><label className="mobile-widget-select">Ansicht<select value={mobileWidget} onChange={event=>setMobileWidget(event.target.value as WidgetId)}>{layout.map(v=><option key={v.id} value={v.id}>{widgetTitles[v.id]}</option>)}</select></label><button type="button" className="btn secondary voice-start" onClick={beginVoice}>◉ Spracheingabe</button><PwaInstall/><label className="add-block">＋ Block<select aria-label="Dashboard-Block hinzufügen" value="" onChange={event => { const id = event.target.value as WidgetId; if (!id) return; const item = findFreePosition(id); if (!item) { setSaveState("Kein freier Platz. Verkleinere oder blende einen Block aus."); return; } const next = [...layoutRef.current, item]; updateLayout(next); setMobileWidget(id); void persist(next); }}><option value="" disabled>Block hinzufügen</option>{missingIds.map(id=><option key={id} value={id}>{widgetTitles[id]}</option>)}</select></label><button type="button" className="btn secondary layout-reset" onClick={resetLayout} title="Canvas auf Startaufteilung zurücksetzen">Layout zurücksetzen</button><a href="/einstellungen" className="btn secondary">Einstellungen</a><form action={signOut}><button className="btn secondary signout-button">Abmelden</button></form></div></header>
      <section className={`dashboard-canvas${dragging ? " canvas-is-dragging" : ""}`} aria-label="Anpassbares Dashboard">
        {dragging&&<div className="canvas-guides" aria-hidden="true">{Array.from({length:dashboardColumns*dashboardRows},(_,index)=><span key={index}/>)}</div>}
        {dropPreview&&<div aria-hidden="true" className="canvas-drop-preview" style={{gridColumn:`${dropPreview.x+1} / span ${dropPreview.w}`,gridRow:`${dropPreview.y+1} / span ${dropPreview.h}`}}/>}
        {layout.map(item => <div key={item.id} data-mobile-active={mobileWidget===item.id} className={`canvas-tile canvas-color-${item.color}${dragging===item.id?" is-dragging":""}`} style={{gridColumn:`${item.x+1} / span ${item.w}`,gridRow:`${item.y+1} / span ${item.h}`}}>
          <div className="widget-toolbar" onPointerDown={event=>startDrag(event,item,"move")} title="Ziehen, um diesen Block zu verschieben"><span className="drag-grip" aria-hidden="true">⠿</span><strong>{widgetTitles[item.id]}</strong><details className="widget-settings" onPointerDown={event=>event.stopPropagation()}><summary aria-label={`${widgetTitles[item.id]} anpassen`}>⚙</summary><div className="widget-settings-popover"><label>Farbe<select value={item.color} onChange={event=>{const next=layoutRef.current.map(v=>v.id===item.id?{...v,color:event.target.value as WidgetColor}:v);updateLayout(next);void persist(next);}}>{colors.map(color=><option value={color.id} key={color.id}>{color.name}</option>)}</select></label><label>Darstellung<select value={item.view} onChange={event=>{const next=layoutRef.current.map(v=>v.id===item.id?{...v,view:event.target.value as WidgetView}:v);updateLayout(next);void persist(next);}}><option value="standard">Ausführlich</option><option value="compact">Kompakt</option><option value="focus">Fokus</option></select></label><button type="button" disabled={layout.length<=1} onClick={()=>{const next=layoutRef.current.filter(v=>v.id!==item.id);if(mobileWidget===item.id)setMobileWidget(next[0].id);updateLayout(next);void persist(next);}}>Block ausblenden</button></div></details></div>
          <div className={`widget-content view-${item.view}`}>
            {item.id==="overview"&&<DailySummaryWidget items={items} onSpeak={beginVoice}/>}
            {item.id==="tasks"&&<TasksWidget items={items} view={item.view}/>}
            {item.id==="calendar"&&<CalendarWidget embedded localEvents={events} view={item.view}/>}
            {item.id==="weather"&&<WeatherWidget embedded view={item.view}/>}
            {item.id==="apple"&&<AppleCalendarWidget embedded view={item.view}/>}
            {item.id==="habits"&&<section className="habit-panel"><div className="section-kicker">Kleine Schritte, grosse Wirkung</div><h2>Gewohnheiten</h2><p className="muted">{items.filter(v=>v.kind==="habit"&&!v.completed_at).length ? `${items.filter(v=>v.kind==="habit"&&!v.completed_at).length} Gewohnheiten in deiner Liste` : "Noch keine Gewohnheiten angelegt."}</p><details className="add-task"><summary>＋ Gewohnheit anlegen</summary><form action={addItem} className="stack-form"><input type="hidden" name="kind" value="habit"/><input type="hidden" name="priority" value="normal"/><label>Titel</label><input name="title" required maxLength={180} placeholder="z. B. 10 Minuten lesen"/><button className="btn">Hinzufügen</button></form></details></section>}
          </div>
          <button className="resize-handle" aria-label={`${widgetTitles[item.id]} vergrössern oder verkleinern`} onPointerDown={event=>startDrag(event,item,"resize")} title="Grösse ändern">◢</button>
        </div>)}
      </section>
      <footer className="dashboard-footer"><span>Blöcke am Griff ⠿ ziehen · rechts unten ◢ skalieren · Einstellungen pro Block über ⚙</span><span><a href="/datenschutz">Datenschutz</a> · <a href="/impressum">Impressum</a></span></footer>
    </main>
    {voiceOpen&&<div className="voice-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeVoice();}}><section className="voice-dialog" role="dialog" aria-modal="true" aria-labelledby="voice-title"><button className="voice-close" type="button" onClick={closeVoice}>×</button><div className="section-kicker">Schnelleingabe</div><h2 id="voice-title">Was steht an?</h2><p className="muted">Sprich z. B. «Termin morgen um 14 Uhr Zahnarzt» oder «Aufgabe morgen Wäsche waschen». Die Erkennung füllt den Entwurf aus; du prüfst ihn vor dem Speichern.</p>{voiceSupported&&<button className={`btn${voiceBusy?" is-listening":""}`} type="button" onClick={beginVoice}>{voiceBusy?"● Höre zu …":"◉ Aufnahme starten"}</button>}{voiceMessage&&<p className="voice-message" role="status">{voiceMessage}</p>}{!voiceSupported&&<label className="voice-command-label">Sprechbefehl<input value={voiceCommand} onChange={event=>{setVoiceCommand(event.target.value);setVoiceDraft(parseVoice(event.target.value));}} placeholder="Windows + H drücken und sprechen"/></label>}<form onSubmit={event=>{event.preventDefault();void saveVoiceDraft(event.currentTarget);}} className="stack-form"><label htmlFor="voice-title-input">Titel</label><input id="voice-title-input" name="title" maxLength={180} required value={voiceDraft?.title||""} onChange={event=>setVoiceDraft(previous=>({kind:previous?.kind||"task",title:event.target.value,date:previous?.date||localDateOffset(0),time:previous?.time||"09:00"}))}/><label htmlFor="voice-kind">Erstellen als</label><select id="voice-kind" value={voiceDraft?.kind||"task"} onChange={event=>setVoiceDraft(previous=>({kind:event.target.value as "task"|"event",title:previous?.title||"",date:previous?.date||localDateOffset(0),time:previous?.time||"09:00"}))}><option value="task">Aufgabe</option><option value="event">Kalendertermin</option></select><div className="voice-fields"><label>Datum<input type="date" value={voiceDraft?.date||localDateOffset(0)} onChange={event=>setVoiceDraft(previous=>({kind:previous?.kind||"task",title:previous?.title||"",date:event.target.value,time:previous?.time||"09:00"}))}/></label>{voiceDraft?.kind==="event"&&<label>Uhrzeit<input type="time" value={voiceDraft.time} onChange={event=>setVoiceDraft(previous=>previous?{...previous,time:event.target.value}:null)}/></label>}</div><button className="btn" disabled={!voiceDraft?.title.trim()}>{voiceDraft?.kind==="event"?"Termin speichern":"Aufgabe speichern"}</button></form><p className="voice-privacy">Die Spracheingabe hängt vom Browser ab. Je nach Browser kann Audio an dessen Spracherkennungsdienst übertragen werden; LifeOS speichert keine Audioaufnahme.</p></section></div>}
  </>;
}

