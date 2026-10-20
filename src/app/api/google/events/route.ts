import {NextResponse} from "next/server";
import {requireUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {decryptSecret} from "@/lib/crypto";
import {z} from "zod";

export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const writableScope="https://www.googleapis.com/auth/calendar.events.owned";
export async function GET(){
 let user;try{({user}=await requireUser())}catch{return json({error:"Anmeldung erforderlich."},401)}
 try{
  const admin=createAdminClient();const {data:connection,error}=await admin.from("google_calendar_connections").select("refresh_token_encrypted,scope").eq("user_id",user.id).maybeSingle();if(error)return json({error:"Kalenderverbindung konnte nicht geladen werden."},503);if(!connection)return json({connected:false,canCreate:false,events:[]});const canCreate=connection.scope===writableScope;
  const refreshToken=decryptSecret(connection.refresh_token_encrypted);const refresh=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||"",client_secret:process.env.GOOGLE_CLIENT_SECRET||"",refresh_token:refreshToken,grant_type:"refresh_token"}),signal:AbortSignal.timeout(10000),cache:"no-store"});
  if(!refresh.ok){const detail=await refresh.json().catch(()=>({})) as {error?:string};if(detail.error==="invalid_grant"){await admin.from("google_calendar_connections").delete().eq("user_id",user.id);return json({connected:false,canCreate:false,error:"Google-Zugriff wurde widerrufen. Bitte verbinde den Kalender erneut."},200)}return json({connected:true,canCreate,error:"Google Kalender ist momentan nicht erreichbar."},503)}
  const token=await refresh.json() as {access_token?:string};if(!token.access_token)return json({connected:true,canCreate,error:"Google lieferte kein Zugriffstoken."},502);
  const now=new Date();const end=new Date(now.getTime()+7*24*60*60*1000);const api=new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");api.search=new URLSearchParams({timeMin:now.toISOString(),timeMax:end.toISOString(),maxResults:"25",singleEvents:"true",orderBy:"startTime",showDeleted:"false"}).toString();
  const response=await fetch(api,{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(10000),cache:"no-store"});if(!response.ok){if(response.status===401||response.status===403){await admin.from("google_calendar_connections").delete().eq("user_id",user.id);return json({connected:false,canCreate:false,error:"Google-Zugriff ist nicht mehr gültig. Bitte verbinde den Kalender erneut."})}return json({connected:true,canCreate,error:"Termine konnten nicht geladen werden."},response.status===429?503:502)}
  const payload=await response.json() as {items?:Array<{id?:string;summary?:string;start?:{dateTime?:string;date?:string};end?:{dateTime?:string;date?:string}}>};const events=(payload.items||[]).map(e=>({id:e.id||crypto.randomUUID(),summary:e.summary||"Termin",start:e.start||{},end:e.end||{}}));return json({connected:true,canCreate,events});
 }catch{return json({connected:true,error:"Kalenderdaten konnten nicht sicher abgerufen werden."},503)}
}

const eventSchema=z.object({title:z.string().trim().min(1).max(180),startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true})});
export async function POST(request:Request){
 let user;try{({user}=await requireUser())}catch{return json({error:"Anmeldung erforderlich."},401)}
 const parsed=eventSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({error:"Bitte Titel und gültige Start-/Endzeit angeben."},400);
 const start=new Date(parsed.data.startsAt),end=new Date(parsed.data.endsAt);if(end<=start||start.getTime()<Date.now()-60_000||end.getTime()-start.getTime()>24*60*60*1000)return json({error:"Der Termin muss künftig liegen und darf höchstens 24 Stunden dauern."},400);
 try{
  const admin=createAdminClient();const {data:connection,error}=await admin.from("google_calendar_connections").select("refresh_token_encrypted,scope").eq("user_id",user.id).maybeSingle();if(error)return json({error:"Kalenderverbindung konnte nicht geladen werden."},503);if(!connection)return json({error:"Google Kalender ist nicht verbunden."},409);if(connection.scope!==writableScope)return json({error:"Google Schreibzugriff muss zuerst erneut freigegeben werden.",needsReauth:true},409);
  const refresh=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||"",client_secret:process.env.GOOGLE_CLIENT_SECRET||"",refresh_token:decryptSecret(connection.refresh_token_encrypted),grant_type:"refresh_token"}),signal:AbortSignal.timeout(10000),cache:"no-store"});
  if(!refresh.ok){const detail=await refresh.json().catch(()=>({})) as {error?:string};if(detail.error==="invalid_grant"){await admin.from("google_calendar_connections").delete().eq("user_id",user.id);return json({error:"Google-Zugriff ist abgelaufen. Verbinde den Kalender erneut.",needsReauth:true},409)}return json({error:"Google Token konnte nicht erneuert werden."},503)}
  const token=await refresh.json() as {access_token?:string};if(!token.access_token)return json({error:"Google lieferte kein Zugriffstoken."},502);
  const response=await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",{method:"POST",headers:{Authorization:`Bearer ${token.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({summary:parsed.data.title,start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()}}),signal:AbortSignal.timeout(10000),cache:"no-store"});
  if(!response.ok){if(response.status===403)return json({error:"Google hat das Erstellen abgelehnt. Prüfe die Freigabe und verbinde den Kalender erneut.",needsReauth:true},409);return json({error:"Google konnte den Termin nicht anlegen."},response.status===429?503:502)}
  const event=await response.json() as {id?:string;htmlLink?:string};return json({ok:true,id:event.id,link:event.htmlLink});
 }catch{return json({error:"Termin konnte nicht sicher an Google übermittelt werden."},503)}
}
