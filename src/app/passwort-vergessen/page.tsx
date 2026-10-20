import Link from "next/link";
import { requestPasswordReset } from "@/app/auth-actions";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ gesendet?: string; fehler?: string }> }) {
  const query = await searchParams;
  return <main className="shell"><header className="top"><Link className="brand" href="/">lifeos.</Link></header><section className="form"><h1>Passwort zurücksetzen</h1><p className="muted">Gib die E-Mail-Adresse deines Kontos ein. Wir senden dir einen sicheren Link, falls ein Konto dazu passt.</p>{query.gesendet ? <p role="status">Falls ein Konto mit dieser Adresse besteht, wurde eine E-Mail mit dem Link zum Zurücksetzen gesendet. Prüfe auch den Spam-Ordner.</p> : <form action={requestPasswordReset}><label htmlFor="reset-email">E-Mail</label><input id="reset-email" name="email" type="email" autoComplete="email" required/><p><button className="btn">Link senden</button></p>{query.fehler && <p role="alert">Der Link konnte nicht angefordert werden. Prüfe die Adresse und versuche es erneut.</p>}</form>}<p className="muted"><Link href="/anmelden">Zur Anmeldung</Link></p></section></main>;
}
