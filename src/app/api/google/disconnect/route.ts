import {NextResponse} from "next/server";
import {requireUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {decryptSecret} from "@/lib/crypto";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return NextResponse.json({error:"Ungültige Anfrage."},{status:403});
 let user;try{({user}=await requireUser())}catch{return NextResponse.json({error:"Anmeldung erforderlich."},{status:401})}
 try{const admin=createAdminClient();const {data}=await admin.from("google_calendar_connections").select("refresh_token_encrypted").eq("user_id",user.id).maybeSingle();if(data){try{const token=decryptSecret(data.refresh_token_encrypted);await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token}),signal:AbortSignal.timeout(8000)});}catch{/* delete local secret even when Google is unavailable */}}const {error}=await admin.from("google_calendar_connections").delete().eq("user_id",user.id);if(error)return NextResponse.json({error:"Verbindung konnte nicht entfernt werden."},{status:503});return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"Verbindung konnte nicht entfernt werden."},{status:503})}
}
