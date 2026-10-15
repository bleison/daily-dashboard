# LifeOS – Einrichtung und Betriebsleitfaden

## Stand und Funktionsumfang

Enthalten sind Supabase Auth SSR, E-Mail-Registrierung/Anmeldung, Dashboard-CRUD für Aufgaben mit Fälligkeit/Priorität, RLS, manuelle Orts-/Wetterabfrage über Open-Meteo, Google Calendar OAuth und iCloud-iCalendar als freiwilliges öffentliches schreibgeschütztes Feed-Abonnement. Kalendergeheimnisse werden verschlüsselt gespeichert. Browser-Sprachsynthese bietet eine Tagesübersicht; eine installierbare PWA zeigt ein LifeOS-Symbol, speichert aber keine privaten Daten offline. Weiter offen sind Passwort-Reset, Export/Kontolöschung, wiederkehrende Gewohnheiten, Ausgaben, vollständige Adminwerkzeuge, Monitoring und Lasttests. Externe Funktionen müssen mit echten Provider-Konfigurationen noch praktisch durchgetestet werden.

## Lokal starten

1. Node.js 20+ installieren; `npm install`, dann `npm run dev`.
2. `.env.example` nach `.env.local` kopieren und eigene Werte lokal eintragen. Geheimnisse niemals in Chat oder Git kopieren.
3. Supabase Dashboard → Project Settings → API: Project URL und publishable/anon key eintragen. Den `service_role`-Key nur als serverseitiges Geheimnis `SUPABASE_SERVICE_ROLE_KEY` setzen. Er darf nie mit `NEXT_PUBLIC_` beginnen und nie in Browsercode erscheinen.
4. Supabase Dashboard → SQL Editor: `supabase/migrations/0001_initial.sql`, danach `0002_google_calendar.sql` und `0003_icloud_calendar.sql` ausführen. Die Kalender-Tabellen haben RLS aktiv und keine Berechtigungen für `anon`/`authenticated`; nur Server-Routen nutzen den Service-Role-Key und filtern jede Abfrage auf die zuvor mit Supabase Auth geprüfte User-ID.
5. Supabase Dashboard → Authentication → URL Configuration: Site URL `http://localhost:3000`, Redirect `http://localhost:3000/auth/callback`.
6. Authentication → Providers → Email: E-Mail-Verifizierung aktivieren. Für einen öffentlichen Dienst SMTP einrichten, Templates und Wiederherstellungsfristen kontrollieren.
7. `NEXT_PUBLIC_APP_URL=http://localhost:3000` setzen.

## Wetter

Das Dashboard fragt nach manueller Eingabe eines Ortes Open-Meteo-Geocoding und Wetter direkt vom Browser ab. Standort wird nicht automatisch ermittelt und nicht lokal gespeichert. Die Eingabe/Koordinaten gehen dabei an Open-Meteo; dessen Attribution wird angezeigt. Die kostenfreie Open-Meteo API ist laut Anbieter nicht-kommerziell, hat Nutzungslimits und keine Verfügbarkeitszusage. Vor öffentlichem kommerziellen Betrieb musst du die Lizenz klären und gegebenenfalls den kommerziellen API-Tarif konfigurieren. Wetteranfragen werden derzeit nicht durch einen eigenen Server-Cache oder app-weites Rate-Limit begrenzt.

## Google Calendar

1. Google Cloud Console → APIs & Services → Library: Google Calendar API aktivieren.
2. Google Auth Platform → Audience/Branding: App-Name, Betreiberkontakt, Support, Zielgruppe und Datenschutzerklärung eintragen. Bei External zunächst das eigene Google-Konto unter Test users hinzufügen. Vor öffentlicher Freigabe Googles nötige Verifizierung beantragen.
3. Google Auth Platform → Clients öffnen und genau den OAuth-Client auswählen, dessen Client-ID in `.env.local` als `GOOGLE_CLIENT_ID` eingetragen ist. Der Client-Typ muss **Web application** sein. Unter **Authorized redirect URIs** exakt `http://localhost:3000/api/google/callback` hinzufügen und speichern. Bei einem Desktop/Installed-Client stattdessen einen Web-Client erstellen und dessen Client-ID und Secret in `.env.local` verwenden. `Authorized JavaScript origins` ist ein separates Feld und ersetzt die Redirect-URI nicht. Google vergleicht Schema, Host, Port und Pfad exakt; ein abschliessender Slash wäre eine andere URI.
4. Für Produktion zusätzlich `https://<deine-echte-domain>/api/google/callback` als Authorized redirect URI in diesem Web-Client ergänzen. Keine Platzhalter-URL eintragen.
5. Werte lokal in `.env.local` und in Vercel → Project Settings → Environment Variables setzen: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SUPABASE_SERVICE_ROLE_KEY`. `GOOGLE_REDIRECT_URI` muss exakt der aktuellen Domain und Callback-URI entsprechen. Vercel nach Änderung neu deployen.
6. Verschlüsselungsschlüssel erzeugen, ohne ihn hier zu teilen: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Ergebnis als `TOKEN_ENCRYPTION_KEY` im lokalen Env/Secret Store eintragen. Schlüssel getrennt sichern; Rotation braucht Migration der bestehenden Chiffrate, Schlüsselverlust macht Tokens unlesbar.
7. Lokale Tests nur mit eigenem Google-Testkonto durchführen. `/api/google/connect` startet State- und PKCE-geschützten OAuth. Scope: `calendar.events.readonly`; Events werden bei Dashboardabruf für sieben Tage direkt von Google gelesen und nicht in der Datenbank zwischengespeichert. Refresh-Tokens liegen AES-256-GCM-verschlüsselt in `google_calendar_connections`. Dashboard → Kalender → Trennen widerruft das Token best-effort bei Google und löscht lokal die Verbindung.

Hinweis zum Google-Testmodus: Bei einer externen OAuth-App im Veröffentlichungsstatus „Testing“ laufen Refresh-Tokens für Calendar-Scopes nach sieben Tagen ab. Für dauerhaft nutzbare Verbindungen muss die App vor öffentlichem Betrieb in den passenden Produktionsstatus wechseln und Googles Verifizierung bestehen.

OAuth-Voraussetzungen: Supabase Auth-Sitzung und Verifizierungs-Callback müssen funktionieren; Service-Role-Key nur serverseitig; Verschlüsselungsschlüssel muss 64 Hex-Zeichen (32 Bytes) haben. Google Token/Calendar API-Limits und Fehler sind begrenzt behandelt, aber ein End-to-End-Test mit echter Google-Konfiguration fehlt noch.

### Apple iCalendar, Sprachübersicht und Installation

Die iCloud-Anbindung ist optional und schreibgeschützt; Apple erklärt, dass Personen mit dem öffentlichen Kalender-Link den Kalender sehen können. Der Feed-Link wird mit `TOKEN_ENCRYPTION_KEY` verschlüsselt in `icloud_calendar_connections` gespeichert. Serverseitig werden nur freigegebene iCloud-Hosts geladen; Redirects bleiben auf derselben iCloud-Origin, Antwortgrösse und Laufzeit sind begrenzt. Termine kommen bei Seitenaufruf direkt aus dem Feed und werden nicht persistent gespeichert. Linkentfernung in LifeOS widerruft die Apple-Freigabe nicht; dazu muss der öffentliche Kalender bei Apple deaktiviert werden.

Die Sprachübersicht nutzt `speechSynthesis` des Browsers und sendet keinen Text an einen externen Sprachdienst. PWA-Installierbarkeit ist verfügbar; der Service Worker cached bewusst keine Inhalte. Der Nutzer installiert die App und heftet sie anschliessend über Windows/Browser an die Taskleiste.

## Vercel

Das öffentliche GitHub-Repository `bleison/daily-dashboard` ist vorhanden. Der verfügbare GitHub-Connector kann dessen Dateien momentan nicht schreiben (403, fehlende Contents-Schreibberechtigung), und lokales Git ist in diesem Workspace schreibgeschützt. Ein Vercel-Projekt `tages-dashboard` wurde angelegt, ist aber noch ohne Deployment und Domain. Nach Aktivierung von Contents-Lese-/Schreibzugriff für den GitHub-Connector kannst du verbinden: im Projektordner `git add .`, `git commit -m "Initial LifeOS"`, `git branch -M main`, `git remote add origin <deine-repository-url>` und `git push -u origin main`. Vor dem Commit prüfen, dass `.env.local` und Google-Client-JSON nicht in `git status` erscheinen. `.gitignore` schliesst sie aus. Niemals `.env.local`, Google JSON oder echte Schlüssel committen.

Danach das Repository in Vercel → Add New → Project verbinden; Framework Next.js automatisch erkennen lassen, Root Directory ist der Repository-Ordner, Build Command `next build`, Install Command `npm install`. Eine `vercel.json` ist nicht erforderlich. In Project Settings → Environment Variables die Schlüssel mit echten Werten hinterlegen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` und optional `ADMIN_EMAILS`. Setze `NEXT_PUBLIC_APP_URL` auf deine echte HTTPS-Domain und `GOOGLE_REDIRECT_URI` auf `https://<domain>/api/google/callback`. `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET` und `TOKEN_ENCRYPTION_KEY` als geheime, nur serverseitige Variablen konfigurieren. Production und Preview getrennt einstellen. Den vorhandenen TOKEN_ENCRYPTION_KEY sichern und bei Neu-Deploys in derselben Umgebung unverändert lassen; bei Verlust werden gespeicherte Google Tokens unlesbar.

Unter Vercel → Settings → Domains eine Domain verbinden. Danach in Google Cloud Console → APIs & Services → Credentials beim Web-OAuth-Client die exakte Produktions-Redirect-URI ergänzen. In Supabase → Authentication → URL Configuration die Site URL auf die Produktionsdomain setzen und sowohl `https://<domain>/auth/callback` als auch `http://localhost:3000/auth/callback` als erlaubte Redirect URLs ergänzen. Google OAuth-Testnutzer/Verifizierung und Supabase SMTP vor öffentlicher Nutzung einrichten. Nach dem ersten Deploy `/`, Registrierung, Verifizierung, Anmeldung, Dashboard, Wetter, Google verbinden/Termine laden/trennen und `/api/health` prüfen.

`ADMIN_EMAILS` ist derzeit eine einfache serverseitige E-Mail-Allowlist; keine vollständige rollenbasierte Administration. Adminseite zeigt nur aggregierte Kontenzahl und keine privaten Inhalte.

## Tests und Verifikation

`npm run typecheck` und `npm run build` wurden nach den Änderungen erfolgreich ausgeführt. Noch fehlen automatisierte Negativtests mit zwei getrennten Konten und anon für SELECT/INSERT/UPDATE/DELETE fremder IDs sowie End-to-End-Tests mit echten Supabase-/Google-Konfigurationen. Mobile Darstellung und echte Vercel/Supabase-Integration müssen praktisch abgenommen werden. Kein 30-Nutzer-Lasttest wurde ausgeführt; p95 und Fehlerrate sind unbekannt. `/api/health` prüft nur die Next.js Route, nicht die Supabase-Verfügbarkeit.

## Bedrohungsmodell / Risiken

| Bedrohung | Wahrscheinlichkeit / Auswirkung | Massnahme | Offen / Restrisiko |
|---|---|---|---|
| Fremdzugriff, manipulierte IDs | mittel / hoch | Auth serverseitig, `auth.uid()`-RLS, FK | RLS-Negativtests fehlen; neue Tabellen einzeln absichern |
| Sitzungsdiebstahl, Passwortangriffe | mittel / hoch | Supabase Auth SSR-Cookies | MFA, App-Limits, produktive Cookieprüfung, SMTP-Konfiguration offen |
| OAuth CSRF, Token-Leak | mittel / hoch | State+PKCE, HttpOnly SameSite Cookie, AES-GCM Token, server-only Service Role | Google E2E-Test, Secret-Rotation, Anbieterverifizierung und Revocation-Fehlerprüfung offen |
| XSS, Injection, ungültige Eingaben | mittel / hoch | React Escaping, Zod, parametrisierte Supabase API | CSP, Security Headers, Pen-Test und umfassende Validierung offen |
| SSRF/Open Redirect | niedrig / mittel | Keine nutzergesteuerten Server-Fetches; Redirect fest | bei Erweiterung neu bewerten |
| Adminmissbrauch/Rolleneskalation | mittel / hoch | keine User-Rollenfelder; E-Mail-Allowlist serverseitig | Allowlist ist kein produktives RBAC; Sperrfunktionen fehlen |
| Brute force, Spam, API-Kosten | mittel / hoch | Supabase Auth Limits anbieterabhängig | eigene Rate-Limits, Quoten und Missbrauchsmonitoring fehlen |
| Offenlegung in Logs | niedrig / hoch | keine Token-Logs, kein Service-Key | Anbieter-Logs und Retention konfigurieren |
| Abhängigkeitslücken | mittel / hoch | kleine Abhängigkeitsmenge | Lockfile/Audit/Updateprozess fehlt |
| Anbieterfehlkonfiguration, Datenverlust | mittel / hoch | RLS SQL, Constraints, Indizes | Backups, Restore-Test, Regionen und Least-Privilege offen |

## Datenfluss und Speicher

| Daten | Zweck | Empfänger/Speicherort | Frist/Löschung |
|---|---|---|---|
| E-Mail/Authdaten | Konto/Anmeldung | Supabase Auth, Region vom Betreiber zu wählen | automatisierte Kontolöschung fehlt |
| Titel/Details/Fälligkeit | Dashboard | Supabase PostgreSQL | bis Löschung; Backupfristen tarifabhängig und zu klären |
| Auth-Cookie | Sitzung | Browser/Supabase SSR | Supabase-Konfiguration; Namen und Laufzeit im Deployment inventarisieren |
| Google Refresh-Token | dauerhafter Kalenderzugriff | nur AES-GCM verschlüsselt in Supabase Tabelle mit RLS und ohne Clientrechte | Verbindung trennen/widerrufen oder Konto löschen; Backup-/Key-Retention beachten |
| Google Termine | Anzeige kommende Woche | kurzfristig Google API → serverseitige Antwort → Dashboard; kein Datenbankcache | nicht dauerhaft durch LifeOS gespeichert; Google eigene Aufbewahrung gilt |
| Wetter-Ort/Koordinaten | Geoauflösung und aktuelle Wetterdaten | direkt vom Browser an Open-Meteo | keine Speicherung in LifeOS; Provider verarbeitet Verbindungsdaten gemäß dessen Bedingungen |
| technische Logs | Betrieb | Vercel/Supabase | Aufbewahrung anbieterabhängig, vor Launch festlegen |

Keine optionalen Analyse-/Marketing-Skripte; derzeit kein Banner für optionale Technologien. Rechtslage und produktive Cookies sind dennoch zu prüfen. Export, Kontolöschung und Einwilligungsverwaltung fehlen. Backups sichern nicht automatisch Verschlüsselungs- oder OAuth-Schlüssel.

## Performance, Backups und Kosten

Dashboardabfrage ist auf 50 Einträge begrenzt, Indizes decken Nutzer/Typ/Erstellungszeit und Fälligkeit ab; private Antworten werden nicht gemeinsam gecacht. 30 parallele Nutzer sind ungetestet. Supabase/Vercel Limits und Kosten hängen von Tarif, Region und Verbrauch ab; vor Wahl in den Anbieter-Dashboards prüfen. Backupintervall, PITR, Retention und Restore-Zeit anhand des tatsächlichen Supabase-Tarifs dokumentieren und Wiederherstellung in einem separaten Projekt üben.

## Incident Response

Vor Launch verantwortliche Incident-Leitung benennen. Eindämmen: Sessions widerrufen/Konten sperren, kompromittierte Secrets rotieren, OAuth Client bei Leak deaktivieren. Umfang und betroffene Daten minimiert untersuchen, keine Tokens in Tickets kopieren. Aus geprüftem Backup wiederherstellen. Melde- und Benachrichtigungspflichten anhand Vorfall und Zuständigkeit fachkundig prüfen; Ursache beheben und Massnahmen nachhalten.

## Launch-Blocker

**Kritisch:** Betreiberidentität/Kontakt; geprüfte Datenschutz-/Nutzungsdokumente; RLS-/Autorisierungstests; unabhängige Sicherheitsprüfung; Datenexport/Kontolöschung; Backup-/Restore-Test; tatsächliche Datenflüsse, Anbieterregionen und Verträge; Rate-Limits.

**Hoch:** Passwort-Reset; CSP/Security Headers; Monitoring/Retention; Cookie-Inventar; Google OAuth End-to-End-Prüfung und Google Verifizierung vor öffentlicher Freischaltung; Admin-RBAC; kommerzielle Open-Meteo Lizenz klären, falls Nutzung kommerziell ist.

**Mittel:** Lasttest für mindestens 30 synthetische Sitzungen mit p95/Fehlerrate/DB-Latenz; Kostenwarnungen; mobile Browserabnahme.

**Niedrig:** erweiterte Gewohnheitsserien, Ausgabenmodell und erweiterte Kalenderansicht.

## Fachliche Prüfung

Schweizer DSG/DSV und gegebenenfalls DSGVO, Anbieterrollen, Auftragsbearbeitung und Auslandtransfers, Aufbewahrung, Löschung aus Backups, Cookie-Recht, Altersanforderungen, Datenschutz-Folgenabschätzung/Verzeichnis, Impressumspflichten und Google User Data Policy anhand Betreiber, Region und Zielmarkt klären. Keine rechtliche Freigabe liegt vor.
# iCloud-Kalender, Vercel und App-Installation

Die Apple-Kalenderintegration ist optional und nur lesend. Zuerst im Supabase SQL Editor `supabase/migrations/0003_icloud_calendar.sql` ausführen. Für API-Routen müssen die bereits in `.env.local` verwendeten Supabase- und `TOKEN_ENCRYPTION_KEY`-Variablen auch in Vercel unter Production und Preview eingerichtet werden. `TOKEN_ENCRYPTION_KEY` muss ein geheimer Schlüssel mit genau 64 Hex-Zeichen sein. Verwende denselben Wert bei allen Instanzen, die gespeicherte Google/iCloud-Tokens lesen müssen; rotiere ihn nicht ohne eine Token-Migrationsstrategie.

In Apple Kalender den Kalender als öffentlich teilen und den `webcal://`-Link in LifeOS → Einstellungen einfügen. Jeder, der diesen Link erhält, kann den Kalender ansehen. Verbinde daher keinen Kalender mit privaten Termindetails. Entfernen in LifeOS löscht den verschlüsselten Link aus LifeOS; um den öffentlichen Link ungültig zu machen, muss die öffentliche Freigabe in Apple Kalender deaktiviert werden. Es werden kommende Termine jeweils live abgerufen, nicht dauerhaft zwischengespeichert.

Die Tageszusammenfassung nutzt die lokale Browser-Sprachsynthese. Qualität und installierte deutsche Stimme hängen vom Browser/Gerät ab. Die PWA speichert keine Dashboard-Inhalte offline. Unter Windows kann die installierte Web-App über das Startmenü bzw. Browsermenü an die Taskleiste angeheftet werden. Auf iPhone/iPad geht dies über Teilen → Zum Home-Bildschirm.

## Veröffentlichung

Vor einem öffentlichen Start: `npm ci`, `npm run typecheck` und `npm run build` ausführen; Datenbankmigrationen auf Supabase ausführen; alle `.env.local`-Werte sicher als Vercel-Umgebungsvariablen setzen; Supabase Auth Site URL/Redirect URLs, Google OAuth Authorized origins/redirect URL und die produktive `NEXT_PUBLIC_APP_URL` auf die endgültige Vercel-Domain umstellen. Nie `.env.local` oder Google-Client-JSON committen.

Datenschutz, Impressum, Cookies und Nutzungsbedingungen enthalten derzeit sichtbare Platzhalter für Betreiberidentität/Kontakt und offene Punkte. Vor Veröffentlichung müssen sie mit echten Angaben und dem tatsächlichen Datenfluss abgeglichen werden. Die Anwendung ist damit noch nicht für einen öffentlichen Nutzerkreis rechtlich startklar.



