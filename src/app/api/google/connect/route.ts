import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const scopes = "https://www.googleapis.com/auth/calendar.events.owned";
function cookieOptions(){return {httpOnly:true as const,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/api/google",maxAge:600};}

export async function GET(request:Request){
  await requireUser();
  const clientId=process.env.GOOGLE_CLIENT_ID;const redirectUri=process.env.GOOGLE_REDIRECT_URI;
  if(!clientId||!redirectUri||!process.env.GOOGLE_CLIENT_SECRET||!process.env.TOKEN_ENCRYPTION_KEY||!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"Google Kalender ist serverseitig noch nicht vollständig konfiguriert."},{status:503});
  let callback:URL;try{callback=new URL(redirectUri)}catch{return NextResponse.json({error:"Google Callback-URL ist ungültig."},{status:503})}
  const current=new URL(request.url);if(callback.origin!==current.origin||callback.pathname!=="/api/google/callback"||(callback.protocol!=="https:"&&callback.hostname!=="localhost"))return NextResponse.json({error:"Google Callback-URL muss exakt zur aktuellen Domain passen."},{status:503});
  const state=randomBytes(32).toString("base64url");const verifier=randomBytes(32).toString("base64url");const challenge=createHash("sha256").update(verifier).digest("base64url");
  const auth=new URL("https://accounts.google.com/o/oauth2/v2/auth");auth.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:scopes,access_type:"offline",prompt:"consent",include_granted_scopes:"false",state,code_challenge:challenge,code_challenge_method:"S256"}).toString();
  const response=NextResponse.redirect(auth);const options=cookieOptions();response.cookies.set("lifeos_google_state",state,options);response.cookies.set("lifeos_google_verifier",verifier,options);return response;
}
