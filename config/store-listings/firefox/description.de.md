**Mehr sehen. Weniger preisgeben.**

Websites erfahren über deinen Browser weit mehr als das, was du in Formulare eingibst. Sie können Standort, Sprache, Zeitzone, Bildschirmgröße, Hardwaremerkmale und weitere Eigenschaften deiner Umgebung auslesen. Selbst über WebGL bereitgestellte Informationen zur Grafikhardware können Teil eines wiedererkennbaren Browser-Fingerabdrucks werden.

**Privacy Thing** gibt dir praktische Kontrolle über diese Ebene deiner Privatsphäre. Es zeigt, auf welche Browserinformationen und Funktionen die im Browser geöffnete Website zugreift, und lässt dich anschließend festlegen, welche ausgewählten Informationen sie sehen darf — für jede Website getrennt.

In Firefox lassen sich Regeln zusätzlich Containern zuweisen. Dieselbe Domain kann dadurch je nach geöffnetem Kontext ein anderes Profil verwenden.

**Kurz gesagt**

1. **Mit Privacy Thing bestimmst du, welche Informationen** dein Browser an Websites und Webanwendungen weitergibt.
2. **Du siehst, welche Daten verwendet wurden und wie oft.**
3. **Du kannst mehrere Regelsätze erstellen** — separat für jede Website und jeden Firefox-Container.
4. **Du kannst verschiedene Standortkonfigurationen anlegen**, die auf geografischer Position, verfügbaren Sprachen und regionalen Einstellungen beruhen. Privacy Thing bietet eine umfassende GPS-Standortsimulation mit einem realistischen Bewegungsmodell.
5. **Privacy Thing ist darauf ausgelegt, möglichst viele Funktionen ohne Verbindung zu externen Diensten bereitzustellen.** Deine Einstellungen bleiben in deiner Hand.

**Was dir Privacy Thing bietet**

1. **Begrenze ausgewählte Bestandteile deines „digitalen Fingerabdrucks“** — je nach Browser und Konfiguration kann Privacy Thing ausgewählte Informationen zu Browser, Bildschirm und Hardware sowie zu Canvas, WebGL, Audio, WebRTC, Frames und Workern kontrollieren oder verändern. Dazu gehören auch Daten, die Eigenschaften der Grafikhardware erkennen lassen können. Privacy Thing bietet konkrete Werkzeuge, um Informationen innerhalb der technischen Reichweite der Erweiterung zu begrenzen und geordnet zu verwalten.

2. **Sieh, was eine Website prüft** — X-Ray zeigt, ob eine Website auf Standort, Sprache, Bildschirmdaten, Canvas, WebGL, Audio, WebRTC oder ausgewählte Worker-Mechanismen zugegriffen hat. Du siehst außerdem, welches Profil angewendet wurde und ob in einer unterstützten Kategorie ein Problem aufgetreten ist. Das ist kein vollständiges Protokoll aller Website-Aktivitäten, sondern ein praktischer Einblick in die Browserbereiche, die Privacy Thing erkennen und kontrollieren kann.

3. **Lege eigene Regeln für jede Website fest** — erstelle Profile und weise sie Domains oder Domainmustern zu. Nutze eine Standardregel, definiere Ausnahmen für einzelne Websites und schalte Privacy Thing vorübergehend aus, ohne deine Konfiguration zu löschen. Du kannst die Erweiterung auch ausschließlich auf ausgewählten Websites verwenden — Privacy Thing legt dich nicht auf nur ein Nutzungsmodell fest.

4. **Trenne Einstellungen nach Firefox-Container** — weise derselben Website je nach Container unterschiedliche Profile zu. So lassen sich Arbeitsbereiche, Konten und Nutzungsszenarien bequem voneinander trennen.

5. **Erstelle stimmige regionale Profile** — verbinde Koordinaten, Standortgenauigkeit, Streuradius der Koordinaten, Hauptsprache, Sprachliste und Zeitzone. Im Assistenten für den ersten Start wählst du schnell fertige regionale Presets aus; eigene Profile kannst du später frei bearbeiten. Die Engine Refract kann unter anderem Geolocation API, `navigator.language`, `navigator.languages`, `Date`, `Intl` und `Accept-Language` aufeinander abstimmen. So muss eine Website keine zufällige Mischung aus einem Standort in einem Land, einer Sprache aus einem anderen und einer dritten Zeitzone sehen.

6. **Nutze realistische Daten ohne unnötige Netzwerkanfragen** — jede Version von Privacy Thing enthält kompakte lokale Datenkataloge, die aus aufbereiteten öffentlichen Datensätzen erstellt werden. Damit kann die Erweiterung ohne zusätzliche Anfragen selbstständig statistisch plausible Hardwareprofile mit passenden Bildschirmauflösungen, CPU-Kernzahlen und Arbeitsspeicherwerten auswählen. Privacy Thing kann außerdem die für eine Website sichtbare Browserversion rotieren. Zusätzlich enthält die Erweiterung Kataloge der von Browsern unterstützten Sprachcodes und der jeweiligen Amtssprachen. Diese Datensätze werden mit der Erweiterung ausgeliefert und über Updates regelmäßig erneuert. Bei der normalen Anwendung von Profilen muss Privacy Thing ihre Quellen nicht abfragen. Auch die Zeitzone kann lokal aus Koordinaten bestimmt werden.

7. **Lösche die Daten einer ausgewählten Website** — Privacy Thing kann Daten der aktuellen Domain löschen, darunter Cookies, `localStorage`, `sessionStorage`, `IndexedDB`, `Cache Storage` und Service Worker. Das hilft sowohl beim Schutz der Privatsphäre als auch beim Testen einer Website mit einem sauberen Ausgangszustand. Nach Abschluss des Vorgangs erhält das Profil einen vollständig neuen Parametersatz, der es der Website deutlich erschweren sollte, Aktivitäten weiterzuverfolgen.

**Deine Daten. Deine Entscheidung.**

Profile, Regeln und Einstellungen bleiben lokal im Browser. Für die Grundfunktionen sind kein Konto und kein eigener Privacy Thing-Server nötig. Die Erweiterung erhebt keine eigene Telemetrie und verkauft keine Daten.

Presets, lokale Kataloge und manuelle Koordinaten funktionieren ohne Kartendienste. Ortssuche und Kartenvorschau verwenden OpenStreetMap Nominatim und OpenFreeMap erst nach deiner Zustimmung.

**Privatsphäre hat mehrere Ebenen**

Privacy Thing arbeitet auf Browserebene. Es ändert nicht deine öffentliche IP-Adresse, leitet oder verschlüsselt keinen Datenverkehr und ersetzt weder VPN noch Proxy oder Smart DNS.

Diese Werkzeuge können sich ergänzen: Netzwerkdienste beeinflussen Verbindung oder Namensauflösung, während Privacy Thing ausgewählte Informationen kontrolliert, die über Browser-APIs sichtbar werden.

Privacy Thing garantiert weder Anonymität noch, dass Änderungen unentdeckt bleiben. Websites können weiterhin IP-Adressen, Kontodaten, Sitzungen und weitere Informationen außerhalb des Einflussbereichs der Erweiterung verwenden. X-Ray zeigt ausschließlich Aktivitäten in unterstützten Bereichen und ist kein vollständiges Audit aller Website-Aktivitäten.
