**Vedi di più. Rivela meno.**

I siti web possono ricavare dal tuo browser molte più informazioni di quelle che inserisci in un modulo. Possono leggere geolocalizzazione, lingua, fuso orario, dimensioni dello schermo, caratteristiche hardware e altri dettagli dell’ambiente. Perfino le informazioni grafiche esposte tramite WebGL possono contribuire a creare un’impronta riconoscibile del browser.

**Privacy Thing** ti offre un controllo concreto su questo livello della privacy. Mostra a quali informazioni e funzionalità del browser accede la pagina aperta e ti permette di scegliere quali informazioni selezionate potrà vedere — con regole distinte per ogni sito.

In Firefox puoi associare le regole anche ai contenitori. Lo stesso dominio può così usare un profilo diverso in base al contesto in cui lo apri.

**In breve**

1. **Privacy Thing ti permette di controllare le informazioni** che il browser comunica a siti e applicazioni web.
2. **Puoi vedere quali dati sono stati utilizzati e quante volte.**
3. **Puoi creare più gruppi di regole**, separatamente per ogni sito e contenitore Firefox.
4. **Puoi creare diverse configurazioni di posizione** basate sulla posizione geografica, sulle lingue disponibili e sulle preferenze regionali. Privacy Thing include un simulatore completo della posizione GPS con un modello di movimento realistico.
5. **Privacy Thing è progettato per offrire quante più funzioni possibile senza doversi collegare a servizi esterni.** Le tue impostazioni restano tue.

**Cosa ti offre Privacy Thing**

1. **Riduci alcuni elementi della tua «impronta digitale»** — in base al browser e alla configurazione, Privacy Thing può controllare o modificare informazioni selezionate relative al browser, allo schermo e all’hardware, oltre a canvas, WebGL, audio, WebRTC, frame e worker. Sono inclusi anche alcuni dati che possono rivelare caratteristiche dell’hardware grafico. Privacy Thing offre strumenti concreti per limitare e organizzare le informazioni che rientrano nella portata dell’estensione.

2. **Scopri quali informazioni consulta un sito** — X-Ray mostra se un sito ha avuto accesso a geolocalizzazione, lingua, dati dello schermo, canvas, WebGL, audio, WebRTC o a determinati meccanismi dei worker. Puoi anche vedere quale profilo è stato applicato e se una categoria supportata ha incontrato un problema. Non è un registro completo di tutto ciò che fa il sito. È una vista pratica delle aree del browser che Privacy Thing sa riconoscere e controllare.

3. **Imposta regole personali per ogni sito** — crea profili e assegnali a domini o pattern di dominio. Usa una regola predefinita, aggiungi eccezioni per siti specifici e disattiva temporaneamente Privacy Thing senza eliminare la configurazione. Puoi anche usare l’estensione soltanto sui siti che scegli — Privacy Thing non ti impone un unico modo di utilizzarla.

4. **Separa le impostazioni tra i contenitori Firefox** — assegna profili diversi allo stesso sito in base al contenitore. È un modo pratico per tenere distinti contesti di lavoro, account e utilizzi.

5. **Crea profili regionali coerenti** — combina coordinate, precisione della geolocalizzazione e raggio di variazione delle coordinate, lingua principale, elenco delle lingue e fuso orario. La procedura guidata del primo avvio consente di scegliere rapidamente preset regionali pronti all’uso, mentre i profili personali restano liberamente modificabili. Il motore Refract può allineare, tra gli altri, Geolocation API, `navigator.language`, `navigator.languages`, `Date`, `Intl` e `Accept-Language`. In questo modo un sito non deve vedere una combinazione casuale di posizione di un Paese, lingua di un altro e fuso orario di un terzo.

6. **Usa dati realistici senza richieste di rete inutili** — ogni versione di Privacy Thing include piccoli cataloghi locali creati a partire da set di dati pubblici elaborati. Grazie a questi cataloghi, l’estensione può scegliere autonomamente, senza richieste aggiuntive, profili hardware statisticamente plausibili con risoluzioni dello schermo, numeri di core della CPU e valori di memoria disponibile adeguati. Privacy Thing può inoltre ruotare la versione del browser visibile a un sito. L’estensione comprende anche cataloghi dei codici lingua supportati dai browser e delle lingue ufficiali. Questi set di dati sono inclusi nell’estensione e aggiornati periodicamente tramite gli aggiornamenti. Durante il normale utilizzo dei profili, Privacy Thing non deve interrogare le fonti originali. Anche il fuso orario può essere determinato localmente dalle coordinate.

7. **Pulisci i dati del sito che scegli** — Privacy Thing può eliminare i dati del dominio corrente, tra cui cookie, `localStorage`, `sessionStorage`, `IndexedDB`, `Cache Storage` e service worker. È utile sia per la privacy sia per testare un sito partendo da uno stato pulito. Al termine dell’operazione, il profilo riceve un insieme di parametri completamente diverso, che dovrebbe rendere molto più difficile per il sito continuare a seguire l’attività.

**I tuoi dati. La tua scelta.**

Profili, regole e impostazioni restano nel browser. Le funzioni principali non richiedono account o server Privacy Thing. L’estensione non raccoglie telemetria propria e non vende dati.

Preset, cataloghi locali e coordinate manuali funzionano senza servizi di mappe. La ricerca dei luoghi e le anteprime della mappa usano OpenStreetMap Nominatim e OpenFreeMap solo dopo la tua scelta.

**La privacy si protegge a più livelli**

Privacy Thing lavora a livello del browser. Non cambia l’IP pubblico, non instrada né cifra il traffico e non sostituisce VPN, proxy o Smart DNS.

Questi strumenti possono completarsi: i servizi di rete agiscono sulla connessione o sulla risoluzione dei nomi, mentre Privacy Thing controlla informazioni selezionate esposte dalle API del browser.

Privacy Thing non garantisce l’anonimato né che le modifiche non siano rilevabili. I siti possono continuare a usare IP, account, sessioni e altre informazioni fuori dalla portata dell’estensione. X-Ray mostra attività soltanto nelle aree supportate: non è un audit completo di tutto ciò che fa il sito.
