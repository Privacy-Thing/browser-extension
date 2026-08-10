**Widzisz więcej. Udostępniasz mniej.**

Strony internetowe wiedzą o Twojej przeglądarce znacznie więcej niż to, co wpisujesz w formularzach. Mogą odczytywać geolokalizację, język, strefę czasową, rozmiar ekranu, parametry sprzętu i inne cechy środowiska. Tak — nawet informacje o układzie graficznym udostępniane przez WebGL mogą stać się częścią rozpoznawalnego profilu.

**Privacy Thing** daje Ci praktyczną kontrolę nad tą warstwą prywatności. Pokazuje, po jakie informacje i funkcje przeglądarki sięga otwarta w przeglądarce strona, a następnie pozwala ustalić, jakie wybrane informacje może zobaczyć — osobno dla każdej witryny.

W Firefoksie możesz dodatkowo przypisywać reguły do kontenerów. Dzięki temu ta sama domena może korzystać z innego profilu zależnie od kontekstu, w którym ją otwierasz.

**TL;DR**

1. **Privacy Thing pozwala sterować informacjami**, jakie przeglądarka internetowa udostępnia stronom i aplikacjom internetowym.
2. **Rozszerzenie pozwala zobaczyć, które dane zostały wykorzystane i ile razy.**
3. **Możesz tworzyć wiele różnych reguł ustawień** osobno dla każdej witryny i kontenera Firefoksa.
4. **Możesz tworzyć wiele ustawień lokalizacji** opartych na pozycji geograficznej, dostępnych językach i preferencjach regionalnych. Privacy Thing ma w pełni funkcjonalny spoofer pozycji GPS z realistycznym modelem symulowania lokalizacji.
5. **Privacy Thing został zbudowany tak, aby oferować jak najwięcej funkcji bez potrzeby łączenia się z zewnętrznymi usługami.** Twoje ustawienia pozostają Twoją własnością.

**Co zyskujesz z Privacy Thing**

1. **Ograniczaj wybrane elementy „cyfrowego odcisku”** — w zależności od przeglądarki i konfiguracji Privacy Thing może kontrolować lub modyfikować wybrane informacje związane z przeglądarką, ekranem i sprzętem, a także canvas, WebGL, audio, WebRTC, ramki i workery. Obejmuje to również część danych, które mogą ujawniać charakterystykę układu graficznego. Privacy Thing to zestaw konkretnych narzędzi do ograniczania i porządkowania informacji, które mieszczą się w zasięgu rozszerzenia.

2. **Zobacz, co sprawdza strona** — X-Ray pokazuje, czy witryna sięgała między innymi po geolokalizację, język, dane ekranu, canvas, WebGL, audio, WebRTC lub wybrane mechanizmy workerów. Widzisz także, jaki profil został zastosowany i czy któraś z obsługiwanych kategorii napotkała problem. Nie jest to pełny rejestr całej aktywności strony. To praktyczny podgląd obszarów przeglądarki, które Privacy Thing potrafi rozpoznawać i kontrolować.

3. **Ustal własne zasady dla każdej witryny** — twórz profile i przypisuj je do domen lub wzorców domen. Możesz korzystać z reguły domyślnej, tworzyć wyjątki dla konkretnych stron i jednym przełącznikiem tymczasowo wyłączyć działanie rozszerzenia bez usuwania konfiguracji. Możesz również używać rozszerzenia wyłącznie na wybranych stronach — Privacy Thing w żadnym razie Cię w tej sprawie nie ogranicza.

4. **Rozdzielaj ustawienia między kontenerami Firefoksa** — przypisz różne profile tej samej witrynie w zależności od kontenera. To wygodny sposób na oddzielenie różnych kontekstów pracy, kont i zastosowań.

5. **Twórz spójne profile regionalne** — profil może łączyć współrzędne, dokładność i promień zmienności geolokalizacji, język, listę języków oraz strefę czasową. Kreator pierwszego uruchomienia pozwala szybko wybrać gotowe presety regionalne, a własne profile możesz później swobodnie edytować. Silnik Refract może dopasować między innymi Geolocation API, `navigator.language`, `navigator.languages`, `Date`, `Intl` i `Accept-Language`. Dzięki temu strona nie musi widzieć przypadkowej mieszanki lokalizacji z jednego kraju, języka z drugiego i strefy czasowej z trzeciego.

6. **Korzystaj z realistycznych danych bez zbędnych zapytań do sieci** — każde wydanie Privacy Thing zawiera niewielkie lokalne katalogi danych budowane z przetworzonych baz publicznych. Dzięki tym bazom rozszerzenie bez wykonywania dodatkowych zapytań może samodzielnie wybrać statystycznie prawdopodobne profile sprzętowe zawierające określone rozdzielczości, liczby rdzeni i wartości dostępnej pamięci RAM. Privacy Thing pozwala również rotować numer wersji przeglądarki widoczny dla witryny. Rozszerzenie zawiera także bazę obsługiwanych przez przeglądarki internetowe kodów językowych oraz języków urzędowych. Zestawy te są dostarczane razem z rozszerzeniem i cyklicznie odświeżane przy jego aktualizacjach. Privacy Thing nie musi odpytywać ich źródeł podczas zwykłego stosowania profili. Strefa czasowa może być wyznaczana lokalnie na podstawie współrzędnych.

7. **Wyczyść dane wybranej witryny** — rozszerzenie pozwala wyczyścić dane bieżącej domeny, między innymi pliki cookie, `localStorage`, `sessionStorage`, `IndexedDB`, `Cache Storage` i service workery. To przydaje się zarówno przy ochronie prywatności, jak i podczas testowania witryny od czystego stanu. Po zakończeniu tej operacji w profilu zostanie wygenerowany zupełnie inny zestaw parametrów, co powinno skutecznie utrudnić witrynie monitorowanie aktywności.

**Twoje dane. Twoja sprawa.**

Profile, reguły i ustawienia są przechowywane lokalnie w przeglądarce. Podstawowe działanie nie wymaga konta ani serwera Privacy Thing. Rozszerzenie nie prowadzi własnej telemetrii i nie sprzedaje danych.

Gotowe presety, lokalne katalogi i ręczne wprowadzanie współrzędnych działają bez wysyłania zapytań do usług mapowych. Dopiero gdy świadomie włączysz wyszukiwanie miejsc lub podgląd mapy, Privacy Thing skorzysta z OpenStreetMap Nominatim i OpenFreeMap. Decyzję możesz później zmienić.

**Prywatność działa warstwami**

Privacy Thing kontroluje wybrane informacje odczytywane bezpośrednio z przeglądarki. Nie zmienia publicznego adresu IP, nie przekierowuje ani nie szyfruje ruchu i nie zastępuje VPN-u, proxy ani Smart DNS.

Te narzędzia rozwiązują inne części problemu i mogą się dobrze uzupełniać. VPN, proxy lub Smart DNS działają na poziomie sieci albo rozwiązywania nazw; Privacy Thing zajmuje się tym, co strona widzi w interfejsach przeglądarki.

Privacy Thing nie gwarantuje anonimowości ani niewykrywalności. Witryny mogą korzystać także z adresu IP, danych konta, sesji i innych źródeł informacji, których rozszerzenie nie kontroluje. X-Ray pokazuje wyłącznie aktywność w obsługiwanych obszarach — nie jest pełnym audytem wszystkiego, co robi strona.
