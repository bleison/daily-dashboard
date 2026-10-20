import Link from "next/link";
import { updatePassword } from "@/app/auth-actions";

const messages: Record<string, string> = { kurz: "Das Passwort muss mindestens 12 Zeichen lang sein.", abweichend: "Die beiden Passwörter stimmen nicht überein.", abgelaufen: "Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen Link an.", "1": "Das Passwort konnte nicht geändert werden. Fordere einen neuen Link an und versuche es erneut." };
export default async function NewPassword({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  return <main className="shell"><header className="top"><Link className="brand" href="/">lifeos.</Link></header><section className="form"><h1>Neues Passwort</h1><p className="muted">Wähle ein neues Passwort mit mindestens 12 Zeichen.</p>{fehler && <p role="alert">{messages[fehler] || messages.abgelaufen}</p>}<form action={updatePassword}><label htmlFor="new-password">Neues Passwort</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required/><label htmlFor="confirm-password">Passwort wiederholen</label><input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={12} required/><p><button className="btn">Passwort speichern</button></p></form><p className="muted"><Link href="/passwort-vergessen">Neuen Link anfordern</Link></p></section></main>;
}
