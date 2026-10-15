import ICAL from "ical.js";

const ICLOUD_HOST = /^p\d+-caldav\.icloud\.com$/i;
const MAX_FEED_BYTES = 1_500_000;
const MAX_EVENTS = 1_000;

export function validateIcloudFeedUrl(input: string): URL {
  if (input.length > 2048) throw new Error("Der Kalenderlink ist zu lang.");
  let url: URL;
  try { url = new URL(input.trim().replace(/^webcal:/i, "https:")); }
  catch { throw new Error("Bitte füge einen gültigen Apple-Kalenderlink ein."); }
  if (url.protocol !== "https:" || !ICLOUD_HOST.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith("/published/") || url.pathname.length < 24) {
    throw new Error("Verwende den öffentlichen HTTPS/iCloud-Link aus Apple Kalender. Andere Hosts werden zum Schutz vor unsicheren Serveranfragen abgelehnt.");
  }
  return url;
}

async function readBounded(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_FEED_BYTES) throw new Error("Der Apple-Kalender ist zu gross (maximal 1,5 MB).");
  if (!response.body) throw new Error("Apple hat keinen Kalenderinhalt geliefert.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > MAX_FEED_BYTES) { await reader.cancel(); throw new Error("Der Apple-Kalender ist zu gross (maximal 1,5 MB)."); }
    chunks.push(value);
  }
  const result = new Uint8Array(total); let offset=0;
  for (const chunk of chunks) { result.set(chunk,offset); offset+=chunk.byteLength; }
  return new TextDecoder("utf-8").decode(result);
}

export async function downloadAppleFeed(input: string): Promise<string> {
  let url = validateIcloudFeedUrl(input);
  for (let attempt=0;attempt<4;attempt++) {
    const response=await fetch(url,{redirect:"manual",headers:{Accept:"text/calendar, application/ics;q=0.9"},signal:AbortSignal.timeout(10000),cache:"no-store"});
    if (response.status>=300 && response.status<400) {
      const location=response.headers.get("location"); if(!location)throw new Error("Apple-Kalender hat eine ungültige Weiterleitung geliefert.");
      const next=validateIcloudFeedUrl(new URL(location,url).toString());
      if(next.origin!==url.origin)throw new Error("Apple-Kalender-Weiterleitung wurde aus Sicherheitsgründen blockiert.");
      url=next;continue;
    }
    if(!response.ok)throw new Error("Apple-Kalender konnte nicht abgerufen werden. Prüfe den Link und ob der Kalender noch öffentlich geteilt wird.");
    const text=await readBounded(response);
    if(!text.includes("BEGIN:VCALENDAR"))throw new Error("Der Link hat keine gültige iCalendar-Datei geliefert.");
    return text;
  }
  throw new Error("Zu viele Weiterleitungen beim Abruf des Apple-Kalenders.");
}

let parserQueue: Promise<void> = Promise.resolve();
export async function parseUpcomingAppleEvents(text: string, from = new Date(), days = 14) {
  const previous=parserQueue; let release!:()=>void; parserQueue=new Promise<void>(resolve=>{release=resolve}); await previous;
  try {
    ICAL.TimezoneService.reset();
    const raw=ICAL.parse(text) as unknown[]; const calendar=new ICAL.Component(raw[1] as unknown[]);
    for(const timezone of calendar.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(new ICAL.Timezone(timezone));
    const end=new Date(from.getTime()+days*86_400_000); const events: {id:string;summary:string;start:string;end:string;allDay:boolean}[]=[];
    let iterations=0;
    for(const component of calendar.getAllSubcomponents("vevent")) {
      if(component.hasProperty("recurrence-id"))continue;
      const event=new ICAL.Event(component); if(!event.startDate || event.component.getFirstPropertyValue("status")==="CANCELLED")continue;
      const add=(item:ICAL.Event,startTime:ICAL.Time,endTime:ICAL.Time)=>{
        const startDate=startTime.toJSDate(),endDate=endTime.toJSDate();
        if(!Number.isFinite(startDate.getTime())||startDate<from||startDate>end||events.length>=MAX_EVENTS)return;
        const rawId=`${item.uid||event.uid}:${startTime.toICALString()}`;
        events.push({id:rawId.slice(0,250),summary:(item.summary||event.summary||"Termin").slice(0,240),start:startDate.toISOString(),end:endDate.toISOString(),allDay:startTime.isDate});
      };
      if(event.isRecurring()) {
        const iterator=event.iterator(); let occurrence:ICAL.Time|null; let safety=0;
        while(safety++<2500 && iterations++<30_000 && (occurrence=iterator.next())) {
          const details=event.getOccurrenceDetails(occurrence);const date=details.startDate.toJSDate();
          if(date>end)break;
          add(details.item as ICAL.Event,details.startDate,details.endDate);
          if(events.length>=MAX_EVENTS)break;
        }
      } else add(event,event.startDate,event.endDate);
      if(events.length>=MAX_EVENTS)break;
    }
    return events.sort((a,b)=>a.start.localeCompare(b.start));
  } finally { ICAL.TimezoneService.reset(); release(); }
}
