import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { downloadAppleFeed, parseUpcomingAppleEvents, validateIcloudFeedUrl } from "@/lib/icloud-calendar";

export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { data, error } = await admin.from("icloud_calendar_connections").select("feed_url_encrypted").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ connected: false, events: [] }, { headers: { "Cache-Control": "no-store" } });
    const url = decryptSecret(data.feed_url_encrypted);
    const calendar = await downloadAppleFeed(url);
    const events = await parseUpcomingAppleEvents(calendar);
    return NextResponse.json({ connected: true, events }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Apple-Kalender konnte nicht geladen werden. Prüfe die Verbindung in Einstellungen." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  try {
    const { user } = await requireUser();
    const body = await request.json();
    if (typeof body.url !== "string") return NextResponse.json({ error: "Kalenderlink fehlt." }, { status: 400 });
    const url = validateIcloudFeedUrl(body.url).toString();
    const feed = await downloadAppleFeed(url);
    await parseUpcomingAppleEvents(feed);
    const { error } = await createAdminClient().from("icloud_calendar_connections").upsert({ user_id: user.id, feed_url_encrypted: encryptSecret(url), updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ connected: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Bitte füge") ? error.message : "Apple-Kalender konnte nicht verbunden werden. Prüfe den öffentlichen iCloud-Link.";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  try {
    const { user } = await requireUser();
    const { error } = await createAdminClient().from("icloud_calendar_connections").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ connected: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Verbindung konnte nicht entfernt werden." }, { status: 401 });
  }
}
