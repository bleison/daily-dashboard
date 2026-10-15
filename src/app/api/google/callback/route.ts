import {timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {encryptSecret} from "@/lib/crypto";

export const dynamic="force-dynamic";
function safeEqual(a:string,b:string){const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function finish(request:Request,result:string){const configured=process.env.NEXT_PUBLIC_APP_URL;let base:string;try{base=configured?new URL(configured).origin:new URL(request.url).origin;}catch{base="http://localhost:3000";}const response=NextResponse.redirect(new URL(`/einstellungen?kalender=${encodeURIComponent(result)}`,base));for(const name of ["lifeos_google_state","lifeos_google_verifier"])response.cookies.set(name,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/google",maxAge:0});return response;}

export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get("code");const state=url.searchParams.get("state");const cookieState=request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith("lifeos_google_state="))?.slice("lifeos_google_state=".length);const verifier=request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith("lifeos_google_verifier="))?.slice("lifeos_google_verifier=".length);
 if(url.searchParams.has("error")||!code||!state||!cookieState||!verifier||!safeEqual(state,cookieState))return finish(request,"fehler");
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return finish(request,"anmeldung-erforderlich");
 const clientId=process.env.GOOGLE_CLIENT_ID;const clientSecret=process.env.GOOGLE_CLIENT_SECRET;const redirectUri=process.env.GOOGLE_REDIRECT_URI;if(!clientId||!clientSecret||!redirectUri||!process.env.TOKEN_ENCRYPTION_KEY||!process.env.SUPABASE_SERVICE_ROLE_KEY)return finish(request,"nicht-konfiguriert");
 try{
  const admin=createAdminClient();const existing=await admin.from("google_calendar_connections").select("refresh_token_encrypted").eq("user_id",user.id).maybeSingle();
  const body=new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:"authorization_code",code_verifier:verifier});
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,signal:AbortSignal.timeout(10000),cache:"no-store"});if(!tokenResponse.ok)return finish(request,"token-fehler");
  const tokens=await tokenResponse.json() as {access_token?:string;refresh_token?:string;scope?:string;expires_in?:number};const expected="https://www.googleapis.com/auth/calendar.events.readonly";if(!tokens.access_token||!tokens.scope?.split(" ").includes(expected))return finish(request,"scope-fehler");
  const encrypted=tokens.refresh_token?encryptSecret(tokens.refresh_token):existing.data?.refresh_token_encrypted;if(!encrypted)return finish(request,"refresh-token-fehlt");
  const {error}=await admin.from("google_calendar_connections").upsert({user_id:user.id,refresh_token_encrypted:encrypted,scope:expected,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)return finish(request,"speicherfehler");
  return finish(request,"verbunden");
 }catch{return finish(request,"fehler");}
}
