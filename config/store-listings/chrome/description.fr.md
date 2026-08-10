Voyez plus. Exposez moins.

Les sites web peuvent apprendre bien plus sur votre navigateur que ce que vous saisissez dans un formulaire. Ils peuvent consulter votre géolocalisation, votre langue, votre fuseau horaire, la taille de votre écran, certaines caractéristiques matérielles et d’autres éléments de votre environnement. Même les informations graphiques exposées par WebGL peuvent contribuer à une empreinte de navigateur reconnaissable.

Privacy Thing vous redonne un contrôle concret sur cette couche de votre vie privée. Il vous montre les informations et fonctions du navigateur auxquelles accède la page ouverte, puis vous laisse choisir les informations qu’elle pourra voir — séparément pour chaque site.

En bref
==================================================

1. Privacy Thing vous permet de contrôler les informations que votre navigateur communique aux sites et aux applications web.
2. Vous voyez quelles données ont été utilisées, et combien de fois.
3. Vous pouvez créer plusieurs jeux de règles, séparément pour chaque site.
4. Vous pouvez créer plusieurs configurations de localisation fondées sur la position géographique, les langues disponibles et les préférences régionales. Privacy Thing intègre un simulateur complet de position GPS doté d’un modèle de déplacement réaliste.
5. Privacy Thing est conçu pour proposer un maximum de fonctions sans devoir se connecter à des services externes. Vos réglages restent les vôtres.

Ce que Privacy Thing vous apporte
==================================================

1. Limitez certains éléments de votre « empreinte numérique »

Selon le navigateur et la configuration, Privacy Thing peut contrôler ou modifier certaines informations liées au navigateur, à l’écran et au matériel, ainsi que canvas, WebGL, l’audio, WebRTC, les frames et les workers. Cela inclut aussi certaines données susceptibles de révéler les caractéristiques du matériel graphique.

Privacy Thing fournit des outils concrets pour limiter et organiser les informations qui se trouvent à la portée de l’extension.

2. Voyez ce que le site consulte

X-Ray, le panneau de diagnostic intégré, indique si le site a accédé à la géolocalisation, à la langue, aux données d’écran, à canvas, WebGL, l’audio, WebRTC ou à certains mécanismes liés aux workers. Vous voyez également quel profil a été appliqué et si une catégorie prise en charge a rencontré un problème.

Il ne s’agit pas d’un journal complet de toute l’activité du site, mais d’une vue pratique des parties du navigateur que Privacy Thing sait reconnaître et contrôler.

3. Définissez vos propres règles pour chaque site

Créez des profils et associez-les à des domaines ou à des motifs de domaine. Utilisez une règle par défaut, ajoutez des exceptions pour certains sites et désactivez temporairement Privacy Thing sans supprimer votre configuration. Vous pouvez aussi limiter l’utilisation de l’extension aux seuls sites de votre choix — Privacy Thing ne vous impose pas un mode de fonctionnement unique.

4. Créez des profils régionaux cohérents

Un profil peut regrouper les coordonnées, la précision de géolocalisation et le rayon de dispersion des coordonnées, la langue principale, la liste des langues et le fuseau horaire. L’assistant de premier démarrage permet de choisir rapidement des préréglages régionaux, tandis que vos propres profils restent librement modifiables.

Le moteur Refract peut harmoniser notamment Geolocation API, navigator.language, navigator.languages, Date, Intl et Accept-Language. Cela évite qu’un site voie un mélange incohérent entre un emplacement dans un pays, une langue dans un autre et un troisième fuseau horaire.

5. Utilisez des données réalistes sans requêtes réseau inutiles

Chaque version de Privacy Thing contient de petits catalogues locaux construits à partir de jeux de données publics traités. Grâce à eux, l’extension peut choisir elle-même, sans requête supplémentaire, des profils matériels statistiquement plausibles avec des résolutions d’écran, des nombres de cœurs processeur et des quantités de mémoire adaptées.

Privacy Thing peut également faire varier la version du navigateur visible par un site, à partir d’un catalogue de versions réelles de Chromium. L’extension contient aussi des catalogues de codes de langue pris en charge par les navigateurs et de langues officielles.

Ces données sont fournies avec l’extension et régulièrement actualisées lors de ses mises à jour. Privacy Thing n’a pas besoin d’interroger leurs sources pendant l’utilisation normale des profils. Le fuseau horaire peut également être déterminé localement à partir des coordonnées.

6. Effacez les données du site de votre choix

Privacy Thing peut effacer les données du domaine actif, notamment les cookies, localStorage, sessionStorage, IndexedDB, Cache Storage et les service workers. C’est utile aussi bien pour la vie privée que pour tester un site à partir d’un état propre. Une fois l’opération terminée, le profil reçoit un ensemble de paramètres entièrement différent, ce qui devrait compliquer nettement le suivi de l’activité par le site.

Vos données. Votre choix.
==================================================

Les profils, règles et paramètres restent dans votre navigateur. Les fonctions principales ne nécessitent ni compte ni serveur Privacy Thing. L’extension ne collecte aucune télémétrie propre et ne vend pas de données.

Les préréglages, catalogues locaux et coordonnées saisies manuellement fonctionnent sans contacter de service cartographique. Privacy Thing utilise OpenStreetMap Nominatim et OpenFreeMap uniquement lorsque vous activez volontairement la recherche de lieux ou l’aperçu de carte. Ce choix reste modifiable.

La vie privée se protège à plusieurs niveaux
==================================================

Privacy Thing contrôle certaines informations lues directement par les interfaces du navigateur. Il ne modifie pas votre adresse IP publique, ne redirige ni ne chiffre le trafic, et ne remplace pas un VPN, un proxy ou un service Smart DNS.

Ces outils traitent d’autres couches du problème et peuvent se compléter. Un VPN, un proxy ou un Smart DNS agit sur le réseau ou la résolution des noms ; Privacy Thing s’occupe de ce que le site voit par l’intermédiaire des API du navigateur.

Privacy Thing ne garantit ni l’anonymat ni que ses modifications soient indétectables. Les sites peuvent aussi exploiter l’adresse IP, les données de compte, les sessions et d’autres informations que l’extension ne contrôle pas. X-Ray ne montre que l’activité des catégories prises en charge : ce n’est pas un audit complet du site.
