Mehr sehen. Weniger preisgeben.

Websites erfahren über deinen Browser weit mehr als das, was du in Formulare eingibst. Sie können Standort, Sprache, Zeitzone, Bildschirmgröße, Hardwaremerkmale und weitere Eigenschaften deiner Umgebung auslesen. Selbst über WebGL bereitgestellte Informationen zur Grafikhardware können Teil eines wiedererkennbaren Browser-Fingerabdrucks werden.

Privacy Thing gibt dir praktische Kontrolle über diese Ebene deiner Privatsphäre. Es zeigt, auf welche Browserinformationen und Funktionen die im Browser geöffnete Website zugreift, und lässt dich anschließend festlegen, welche ausgewählten Informationen sie sehen darf — für jede Website getrennt.

Kurz gesagt
==================================================

1. Mit Privacy Thing bestimmst du, welche Informationen dein Browser an Websites und Webanwendungen weitergibt.
2. Du siehst, welche Daten verwendet wurden und wie oft.
3. Du kannst mehrere Regelsätze erstellen — separat für jede Website.
4. Du kannst verschiedene Standortkonfigurationen auf Basis von geografischer Position, verfügbaren Sprachen und regionalen Einstellungen anlegen. Privacy Thing bietet eine umfassende GPS-Standortsimulation mit einem realistischen Bewegungsmodell.
5. Privacy Thing ist darauf ausgelegt, möglichst viele Funktionen ohne Verbindung zu externen Diensten bereitzustellen. Deine Einstellungen bleiben in deiner Hand.

Was dir Privacy Thing bietet
==================================================

1. Begrenze ausgewählte Bestandteile deines „digitalen Fingerabdrucks“

Je nach Browser und Konfiguration kann Privacy Thing ausgewählte Informationen zu Browser, Bildschirm und Hardware sowie zu Canvas, WebGL, Audio, WebRTC, Frames und Workern kontrollieren oder verändern. Dazu gehören auch Daten, die Eigenschaften der Grafikhardware erkennen lassen können.

Privacy Thing bietet konkrete Werkzeuge, um Informationen innerhalb der technischen Reichweite der Erweiterung zu begrenzen und geordnet zu verwalten.

2. Sieh, was eine Website prüft

X-Ray, das integrierte Diagnosepanel, zeigt, ob eine Website unter anderem auf Standort, Sprache, Bildschirmdaten, Canvas, WebGL, Audio, WebRTC oder ausgewählte Worker-Mechanismen zugegriffen hat. Du siehst außerdem, welches Profil angewendet wurde und ob in einer unterstützten Kategorie ein Problem aufgetreten ist.

Das ist kein vollständiges Protokoll aller Website-Aktivitäten, sondern ein praktischer Einblick in die Browserbereiche, die Privacy Thing erkennen und kontrollieren kann.

3. Lege eigene Regeln für jede Website fest

Erstelle Profile und weise sie Domains oder Domainmustern zu. Nutze eine Standardregel, definiere Ausnahmen für einzelne Websites und schalte Privacy Thing bei Bedarf vorübergehend aus, ohne deine Konfiguration zu löschen. Du kannst die Erweiterung auch ausschließlich auf ausgewählten Websites verwenden — Privacy Thing legt dich nicht auf nur ein Nutzungsmodell fest.

4. Erstelle stimmige regionale Profile

Ein Profil kann Koordinaten, Standortgenauigkeit und Streuradius der Koordinaten, Hauptsprache, Sprachliste und Zeitzone verbinden. Im Assistenten für den ersten Start wählst du schnell fertige regionale Presets aus; eigene Profile kannst du später frei bearbeiten.

Die Engine Refract kann unter anderem Geolocation API, navigator.language, navigator.languages, Date, Intl und Accept-Language aufeinander abstimmen. So muss eine Website keine zufällige Mischung aus einem Standort in einem Land, einer Sprache aus einem anderen und einer dritten Zeitzone sehen.

5. Nutze realistische Daten ohne unnötige Netzwerkanfragen

Jede Version von Privacy Thing enthält kompakte lokale Datenkataloge, die aus aufbereiteten öffentlichen Datensätzen erstellt werden. Damit kann die Erweiterung ohne zusätzliche Anfragen selbstständig statistisch plausible Hardwareprofile mit passenden Bildschirmauflösungen, CPU-Kernzahlen und Arbeitsspeicherwerten auswählen.

Privacy Thing kann außerdem die für eine Website sichtbare Browserversion rotieren. Grundlage dafür ist ein Katalog realer Chromium-Versionen. Zusätzlich enthält die Erweiterung Kataloge der von Browsern unterstützten Sprachcodes und der jeweiligen Amtssprachen.

Diese Datensätze werden mit der Erweiterung ausgeliefert und über Updates regelmäßig erneuert. Bei der normalen Anwendung von Profilen muss Privacy Thing ihre Quellen nicht abfragen. Auch die Zeitzone kann lokal aus Koordinaten bestimmt werden.

6. Lösche die Daten einer ausgewählten Website

Privacy Thing kann Daten der aktuellen Domain löschen, darunter Cookies, localStorage, sessionStorage, IndexedDB, Cache Storage und Service Worker. Das hilft sowohl beim Schutz der Privatsphäre als auch beim Testen einer Website mit einem sauberen Ausgangszustand. Nach Abschluss des Vorgangs erhält das Profil einen vollständig neuen Parametersatz, der es der Website deutlich erschweren sollte, Aktivitäten weiterzuverfolgen.

Deine Daten. Deine Entscheidung.
==================================================

Profile, Regeln und Einstellungen bleiben lokal in deinem Browser. Für die Grundfunktionen sind weder ein Privacy Thing-Konto noch ein eigener Privacy Thing-Server erforderlich. Die Erweiterung erhebt keine eigene Telemetrie und verkauft keine Daten.

Fertige Presets, lokale Kataloge und manuell eingegebene Koordinaten funktionieren ohne Anfragen an Kartendienste. Erst wenn du Ortssuche oder Kartenvorschau bewusst aktivierst, verwendet Privacy Thing OpenStreetMap Nominatim und OpenFreeMap. Diese Entscheidung kannst du jederzeit ändern.

Privatsphäre hat mehrere Ebenen
==================================================

Privacy Thing kontrolliert ausgewählte Informationen, die direkt über Browser-Schnittstellen ausgelesen werden. Es ändert nicht deine öffentliche IP-Adresse, leitet oder verschlüsselt keinen Datenverkehr und ersetzt weder VPN noch Proxy oder Smart DNS.

Diese Werkzeuge lösen andere Teile des Problems und können sich gut ergänzen. VPN, Proxy oder Smart DNS wirken auf Netzwerk- oder Namensauflösungsebene; Privacy Thing kümmert sich um das, was eine Website über Browser-APIs sieht.

Privacy Thing garantiert weder Anonymität noch, dass Änderungen unentdeckt bleiben. Websites können zusätzlich IP-Adresse, Kontodaten, Sitzungen und andere Informationen verwenden, die außerhalb der Kontrolle der Erweiterung liegen. X-Ray zeigt nur Aktivitäten in unterstützten Kategorien — es ist keine vollständige Prüfung der Website.
