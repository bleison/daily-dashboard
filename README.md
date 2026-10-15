# LifeOS – Tages-Dashboard

Next.js App-Router-Projekt für ein persönliches Organisationsdashboard. Enthält Supabase Auth SSR, RLS-geschützte Einträge, Aufgaben mit Fälligkeit/Priorität, Wetter, Google Kalender, optionale Apple-iCalendar-Feeds, vorlesbare Tagesübersicht und PWA-Installation.

Kalender-Feeds sind lesend. Apple-iCloud-Feeds müssen öffentlich geteilt werden; jeder Inhaber des Links kann sie ansehen. Das Impressum weist darauf hin, dass die Betreiberadresse noch fehlt. Bitte vor öffentlicher Nutzung die rechtlichen Angaben und alle Launch-Hinweise in [SETUP.md](SETUP.md) prüfen.

Siehe [SETUP.md](SETUP.md) für Einrichtung, Supabase-Migrationen, Sicherheitsmodell und Launch-Blocker. Geheimnisse gehören ausschliesslich in lokale Umgebungsvariablen oder den Hosting-Secret-Store.