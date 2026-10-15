"use client";
import { useEffect, useState } from "react";

type CalendarEvent = { id: string; summary: string; start: string; end: string; allDay: boolean };
export default function AppleCalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => { fetch("/api/apple-calendar", { cache: "no-store" }).then(async r => { if (!r.ok) return; const data = await r.json(); setEvents(data.events); setConnected(data.connected); }).catch(() => setEvents([])); }, []);
  return <article className="card"><div className="section-kicker">Apple Kalender</div><h2>iCloud-Termine</h2>{!events ? <p className="muted">Kalender wird geladen …</p> : connected ? events.length ? <ul className="calendar-list">{events.slice(0, 5).map(event => <li key={event.id}><time>{event.allDay ? new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "short" }).format(new Date(event.start)) : new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.start))}</time><span>{event.summary}</span></li>)}</ul> : <p className="muted">Keine kommenden Termine in den nächsten zwei Wochen.</p> : <p className="muted">Verbinde deinen iCloud-Kalender in <a href="/einstellungen">Einstellungen</a>.</p>}<p className="muted small-note">Nur Lesen · Aktualisierung beim Öffnen</p></article>;
}
