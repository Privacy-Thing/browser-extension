Widzisz więcej. Udostępniasz mniej.

Strony internetowe wiedzą o Twojej przeglądarce znacznie więcej niż to, co wpisujesz w formularzach. Mogą odczytywać geolokalizację, język, strefę czasową, rozmiar ekranu, parametry sprzętu i inne cechy środowiska. Tak — nawet informacje o układzie graficznym udostępniane przez WebGL mogą stać się częścią rozpoznawalnego profilu.

Privacy Thing daje Ci praktyczną kontrolę nad tą warstwą prywatności. Pokazuje, po jakie  informacje i funkcje przeglądarki sięga otwarta w przeglądarce strona, a następnie pozwala ustalić, jakie wybrane informacje może zobaczyć — osobno dla każdej witryny.

TL;DR
==================================================

1. Privacy Thing pozwala sterować informacjami, jakie przeglądarka internetowa udostępnia stronom i aplikacjom internetowym
2. Rozszerzenie pozwala zobaczyć które i ile razy z te dane zostały wykorzystane.
3. Użytkownik może stworzyć wiele różnych reguł ustawień dla każdej z witryny z osobna.
4. Rozszerzenie pozwala na stworzenie wielu ustawień lokalizacji, które bazują na pozycji geograficznej, dostępnych językach i preferencjach ustawień regionalnych. Rozszerzenie posiada w pełni funkcjonalny spoofer pozycji GPS z realistycznym modelem symulowania lokalizacji.
5. Privacy Thing został zbudowany z myślą, aby oferować jak najwiecej funkcji bez potrzeby łączenia się z zewnętrznymi usługami. Twoje ustawienia pozostają twoją własnością.

Co zyskujesz z Privacy Thing
==================================================

1. Ograniczaj wybrane elementy "cyfrowego odcisku"

W zależności od przeglądarki i konfiguracji Privacy Thing może kontrolować lub modyfikować wybrane informacje związane z przeglądarkąnavigatorem, ekranem i sprzętem, a także Ccanvas, WebGL, audio, WebRTC, ramki i workery. Obejmuje to również część danych, które mogą ujawniać charakterystykę układu graficznego.

Privacy Thing to zestaw konkretnych narzędzi do ograniczania i porządkowania informacji, które mieszczą się w zasięgu rozszerzenia.

2. Zobacz, co sprawdza strona

X-Ray, wbudowany panel diagnostyczny, pokazuje, czy witryna sięgała między innymi po geolokalizację, język, dane ekranu, canvas, WebGL, audio, WebRTC lub wybrane mechanizmy workerów. Widzisz także, jaki profil został zastosowany i czy któraś z obsługiwanych kategorii napotkała problem.

Nie jest to pełny rejestr całej aktywności strony. To praktyczny podgląd obszarów przeglądarki, które Privacy Thing potrafi rozpoznawać i kontrolować.

3. Ustal własne zasady dla każdej witryny

Twórz profile i przypisuj je do domen lub wzorców domen. Możesz korzystać z reguły domyślnej, tworzyć wyjątki dla konkretnych stron i jednym przełącznikiem tymczasowo wyłączyć działanie rozszerzenia bez usuwania konfiguracji. Możesz również używać rozszerzenia wyłącznie na wybranych stronach - Privacy Thing w żadnym razie Ciebie w tej sprawie nie ogranicza.

4. Twórz spójne profile regionalne

Profil może łączyć współrzędne, dokładność i promień zmienności geolokalizacji, język, listę języków oraz strefę czasową. Kreator pierwszego uruchomienia pozwala szybko wybrać gotowe presety regionalne, a własne profile możesz później swobodnie edytować.

Silnik Refract może dopasować między innymi Geolocation API, navigator.language, navigator.languages, Date, Intl i Accept-Language. Dzięki temu strona nie musi widzieć przypadkowej mieszanki lokalizacji z jednego kraju, języka z drugiego i strefy czasowej z trzeciego.

5. Korzystaj z realistycznych danych bez zbędnych zapytań do sieci

Każde wydanie Privacy Thing zawiera niewielkie lokalne katalogi danych budowane z przetworzonych baz publicznych. Dzięki tym bazom rozszerzenie bez wykonywania dodatkowych zapytań może samodzielenie wybrać statystycznie prawdopodobne profile sprzętowe zawierające określone rozdzielczości, liczby rdzeni i wartości dostępnej pamięci RAM.

Privacy Thing pozwala również rotować numer wersji Twojej przeglądarki, pozwala na to baza rzeczywistych wydań Chromium. Rozszerzenie posiada również bazę obsługiwanych przez przeglądarki internetowe kodów językowych oraz języków urzędowych.

Te zestawy są dostarczane razem z rozszerzeniem i cyklicznie odświeżane przy jego aktualizacjach. Privacy Thing nie musi odpytywać ich źródeł podczas zwykłego stosowania profili. Strefa czasowa może być wyznaczana lokalnie na podstawie współrzędnych.

6. Wyczyść dane wybranej witryny.

Rozszerzenie pozwala wyczyścić dane bieżącej domeny, między innymi pliki cookie, localStorage, sessionStorage, IndexedDB, Cache Storage i service workery. To przydaje się zarówno przy ochronie prywatności, jak i podczas testowania witryny od czystego stanu. Po zakończeniu tej operacji, w profilu wygenerowany zostanie zupełnie inny zestaw parametrów, co powinno skutecznie utrudnić witrynie monitorowanie aktywności.

Twoje dane. Twoja sprawa.
==================================================

Profile, reguły i ustawienia są przechowywane lokalnie w przeglądarce. Podstawowe działanie nie wymaga konta ani serwera Privacy Thing. Rozszerzenie nie prowadzi własnej telemetrii i nie sprzedaje danych.

Gotowe presety, lokalne katalogi i ręczne wprowadzanie współrzędnych działają bez wysyłania zapytań do usług mapowych. Dopiero gdy świadomie włączysz wyszukiwanie miejsc lub podgląd mapy, Privacy Thing skorzysta z OpenStreetMap Nominatim i OpenFreeMap. Decyzję możesz później zmienić.

Prywatność działa warstwami
==================================================

Privacy Thing kontroluje wybrane informacje odczytywane bezpośrednio z przeglądarki. Nie zmienia publicznego adresu IP, nie przekierowuje ani nie szyfruje ruchu i nie zastępuje VPN-u, proxy ani Smart DNS.

Te narzędzia rozwiązują inne części problemu i mogą się dobrze uzupełniać. VPN, proxy lub Smart DNS działają na poziomie sieci albo rozwiązywania nazw; Privacy Thing zajmuje się tym, co strona widzi w interfejsach przeglądarki.

Privacy Thing nie gwarantuje anonimowości ani niewykrywalności. Witryny mogą korzystać także z adresu IP, danych konta, sesji i innych źródeł informacji, których rozszerzenie nie kontroluje. X-Ray pokazuje wyłącznie aktywność w obsługiwanych obszarach — nie jest pełnym audytem wszystkiego, co robi strona.
