**Descubre más. Expón menos.**

Los sitios web pueden saber mucho más sobre tu navegador que lo que escribes en un formulario. Pueden consultar tu geolocalización, idioma, zona horaria, tamaño de pantalla, características del dispositivo y otros detalles del entorno. Incluso la información gráfica expuesta mediante WebGL puede formar parte de una huella reconocible del navegador.

**Privacy Thing** te ofrece control práctico sobre esta capa de tu privacidad. Muestra a qué información y funciones del navegador accede la página que tienes abierta y te permite decidir qué información seleccionada podrá ver — con reglas independientes para cada web.

En Firefox, las reglas también se pueden asignar a contenedores. El mismo dominio puede utilizar un perfil diferente según el contexto en el que lo abras.

**En pocas palabras**

1. **Privacy Thing te permite controlar la información** que el navegador facilita a sitios y aplicaciones web.
2. **Puedes ver qué datos se han utilizado y cuántas veces.**
3. **Puedes crear distintos conjuntos de reglas**, por separado para cada web y cada contenedor de Firefox.
4. **Puedes crear varias configuraciones de ubicación** basadas en la posición geográfica, los idiomas disponibles y las preferencias regionales. Privacy Thing incorpora un simulador completo de posición GPS con un modelo de movimiento realista.
5. **Privacy Thing está diseñado para ofrecer el mayor número posible de funciones sin necesidad de conectarse a servicios externos.** Tus ajustes siguen siendo tuyos.

**Lo que te aporta Privacy Thing**

1. **Reduce elementos seleccionados de tu «huella digital»** — según el navegador y la configuración, Privacy Thing puede controlar o modificar información seleccionada relacionada con el navegador, la pantalla y el hardware, además de canvas, WebGL, audio, WebRTC, frames y workers. Esto incluye algunos datos que pueden revelar características del hardware gráfico. Privacy Thing ofrece un conjunto concreto de herramientas para limitar y organizar la información que está al alcance de la extensión.

2. **Descubre qué información consulta cada sitio** — X-Ray muestra si una web ha accedido a la geolocalización, el idioma, los datos de pantalla, canvas, WebGL, audio, WebRTC o determinados mecanismos de los workers. También puedes ver qué perfil se aplicó y si alguna categoría compatible encontró un problema. No es un registro completo de toda la actividad del sitio. Es una vista práctica de las áreas del navegador que Privacy Thing puede reconocer y controlar.

3. **Define tus propias reglas para cada web** — crea perfiles y asígnalos a dominios o patrones de dominio. Usa una regla predeterminada, añade excepciones para sitios concretos y desactiva Privacy Thing temporalmente sin borrar tu configuración. También puedes hacer que la extensión funcione solo en las webs que elijas — Privacy Thing no te obliga a usar un único modelo.

4. **Separa los ajustes entre contenedores de Firefox** — asigna perfiles distintos al mismo sitio según el contenedor. Es una forma práctica de mantener separados los contextos de trabajo, las cuentas y los usos.

5. **Crea perfiles regionales coherentes** — combina coordenadas, precisión de geolocalización y radio de variación de las coordenadas, idioma principal, lista de idiomas y zona horaria. El asistente del primer inicio permite elegir rápidamente preajustes regionales, y tus propios perfiles se pueden editar libremente después. El motor Refract puede coordinar, entre otros, Geolocation API, `navigator.language`, `navigator.languages`, `Date`, `Intl` y `Accept-Language`. Así, un sitio no tiene por qué ver una mezcla accidental de una ubicación de un país, un idioma de otro y una zona horaria de un tercero.

6. **Usa datos realistas sin consultas de red innecesarias** — cada versión de Privacy Thing incluye pequeños catálogos locales creados a partir de conjuntos de datos públicos procesados. Gracias a ellos, la extensión puede elegir por sí sola, sin solicitudes adicionales, perfiles de hardware estadísticamente plausibles con resoluciones de pantalla, números de núcleos de CPU y valores de memoria disponible adecuados. Privacy Thing también puede rotar la versión del navegador que ve una web. La extensión incluye además catálogos de códigos de idioma compatibles con los navegadores y de idiomas oficiales. Estos conjuntos se distribuyen con la extensión y se renuevan periódicamente mediante sus actualizaciones. Privacy Thing no necesita consultar sus fuentes durante el uso normal de los perfiles. La zona horaria también puede calcularse localmente a partir de las coordenadas.

7. **Limpia los datos de la web que elijas** — Privacy Thing puede limpiar los datos del dominio actual, como cookies, `localStorage`, `sessionStorage`, `IndexedDB`, `Cache Storage` y service workers. Es útil tanto para proteger tu privacidad como para probar una web desde un estado limpio. Al terminar la operación, el perfil recibe un conjunto de parámetros completamente distinto, lo que debería dificultar considerablemente que la web siga la actividad.

**Tus datos. Tú decides.**

Los perfiles, reglas y ajustes permanecen localmente en tu navegador. Las funciones principales no requieren cuenta ni servidor de Privacy Thing. La extensión no recopila telemetría propia ni vende datos.

Los preajustes, catálogos locales y coordenadas manuales funcionan sin servicios de mapas. La búsqueda de lugares y las vistas previas usan OpenStreetMap Nominatim y OpenFreeMap solo después de que las actives.

**La privacidad se protege por capas**

Privacy Thing funciona en la capa del navegador. No cambia tu IP pública, no redirige ni cifra el tráfico y no sustituye una VPN, un proxy o Smart DNS.

Estas herramientas pueden complementarse: los servicios de red afectan a la conexión o la resolución de nombres, mientras Privacy Thing controla información seleccionada expuesta mediante las API del navegador.

Privacy Thing no garantiza el anonimato ni que sus cambios sean indetectables. Los sitios pueden seguir usando direcciones IP, datos de cuentas, sesiones y otra información fuera del alcance de la extensión. X-Ray solo muestra actividad en las áreas compatibles: no es una auditoría completa de todo lo que hace una web.
