import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const ABOUT_PRODUCT = `Acerca de ${BRAND_DISPLAY_NAME}`;
const ABOUT_PRODUCT_LOWER = `acerca de ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT = `Cómo usar ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT_LOWER = `cómo usar ${BRAND_DISPLAY_NAME}`;
const WHAT_PRODUCT_IS_NOT = `Qué ${BRAND_DISPLAY_NAME} no es`;
const PRODUCT_NOT_LOWER = `qué ${BRAND_DISPLAY_NAME} no es`;
const TERMS_OF_USE = "Términos de uso";

export const about = {
  title: ABOUT_PRODUCT,
  description: `${BRAND_DISPLAY_NAME} te ayuda a controlar cómo los sitios web ven tu ubicación, idioma, zona horaria y detalles de identidad del navegador seleccionados.`,
  body1:
    "Cada perfil regional guardado reúne coordenadas, preferencias de idioma y una zona horaria en una configuración reutilizable que puedes aplicar a distintos dominios sin tener que crearla de nuevo.",
  body2: `Los cambios se guardan automáticamente. Los perfiles y las reglas actualizados surten efecto al volver a cargar la página, para que ${BRAND_DISPLAY_NAME} pueda aplicar la nueva configuración desde el principio.`,
  body3Prefix:
    "Puedes encontrar los controles de protección del navegador compartidos en la",
  body3LinkLabel: "pestaña de Opciones",
  body3Suffix: ".",
  website: {
    prefix: "Puedes visitar el ",
    linkLabel: `sitio web de ${BRAND_DISPLAY_NAME}`,
    url: "https://privacything.com",
    suffix: " para noticias del proyecto, descargas y más información.",
  },
  versionLabel: "Versión",
  browserTargetLabel: "Objetivo del navegador",
  releaseChannelLabel: "Canal de lanzamiento",
  copyLinkLabel: ABOUT_PRODUCT_LOWER,
  copyLinkTermsLabel: "términos de uso",
  copyLinkPrivacyLabel: "sobre la privacidad",
  copyLinkLimitationsLabel: PRODUCT_NOT_LOWER,
  copyLinkLicenseLabel: "licencia",
  copyLinkAssetsLabel: "recursos de terceros",
  copyLinkUsageLabel: HOW_TO_USE_PRODUCT_LOWER,
  releaseChannels: {
    local: "Local",
    beta: "Beta",
    stable: "Estable",
  },

  support: {
    url: "https://webh.pl",
    logoLinkAriaLabel: "Abrir webh.pl",
    bodyPrefix: `${BRAND_DISPLAY_NAME} crece con el apoyo de `,
    linkLabel: "webh.pl",
    bodySuffix: " — infraestructura rápida y flexible para proyectos ambiciosos.",
  },

  terms: {
    title: TERMS_OF_USE,
    body1: `${BRAND_DISPLAY_NAME} se proporciona “tal cual”, sin garantía de ningún tipo.`,
    body2: `${BRAND_DISPLAY_NAME} ayuda a los usuarios a controlar localmente la ubicación, la configuración regional, la zona horaria y los datos relacionados expuestos por el navegador. No es una VPN, proxy, herramienta de anonimato, producto de seguridad ni garantía de indetectabilidad.`,
    body3: `Usa ${BRAND_DISPLAY_NAME} bajo tu propia responsabilidad. Debes cumplir las leyes aplicables, las condiciones de los sitios web, las políticas de tu lugar de trabajo y las normas de las plataformas.`,
  },

  privacy: {
    title: "Privacidad",
    body: `${BRAND_DISPLAY_NAME} guarda localmente en tu navegador tus opciones y datos de configuración. Las solicitudes externas de mapas son opcionales: tras obtener tu consentimiento, usa OpenStreetMap Nominatim para buscar ubicaciones y OpenFreeMap para mostrar vistas previas interactivas.`,
    openPolicyButton: "Abrir política de privacidad",
  },

  limitations: {
    title: WHAT_PRODUCT_IS_NOT,
    intro: `${BRAND_DISPLAY_NAME} cambia los datos visibles en el navegador como la geolocalización, la configuración regional, la zona horaria y los detalles de la huella digital seleccionados. No enruta tu tráfico a través de una red diferente.`,
    body1: "No oculta ni reemplaza tu dirección IP.",
    body2: "No reemplaza una VPN, proxy o configuración de enrutamiento basada en DNS.",
    body3:
      "No hace que los sitios web vean tu conexión como proveniente de otro país por sí solo.",
    outro: `Usa ${BRAND_DISPLAY_NAME} para simular datos en el navegador. Usa una VPN, un proxy o herramientas DNS cuando necesites cambiar la ubicación a nivel de red.`,
  },

  license: {
    title: "Licencia",
    creatorPrefix: "Este proyecto fue creado por ",
    creatorLabel: "Tomasz Janusz",
    creatorUrl: "https://tomaszjanusz.dev",
    creatorSuffix: ".",
    copyright: "Copyright © 2025-presente.",
    body: `${BRAND_DISPLAY_NAME} está disponible bajo la Licencia Pública General Affero de GNU v3.0 o posterior, con términos adicionales.`,
    openLicenseButton: "Abrir licencia",
  },

  assets: {
    title: "Recursos de terceros",
    body: `Consulta los componentes de terceros incluidos y los textos de sus licencias distribuidos con ${BRAND_DISPLAY_NAME}.`,
    openNoticesButton: "Abrir avisos de terceros",
    fontAwesome: {
      label: "Font Awesome Free 7.2.0",
      url: "https://fontawesome.com",
      body: " por Font Awesome / Fonticons, Inc. está licenciado bajo CC BY 4.0, SIL OFL 1.1 y MIT.",
    },
    mapLibre: {
      label: "MapLibre GL JS",
      url: "https://maplibre.org/maplibre-gl-js/docs/",
      body: " se incluye localmente para la renderización de mapas vectoriales.",
    },
    openFreeMap: {
      label: "OpenFreeMap",
      url: "https://openfreemap.org/",
    },
    openStreetMap: {
      label: "OpenStreetMap",
      url: "https://www.openstreetmap.org/copyright",
    },
    osmWikiCountryCodes: {
      label: "Wiki de OpenStreetMap: Nominatim/Country Codes",
      url: "https://wiki.openstreetmap.org/wiki/Nominatim/Country_Codes",
      body: " proporciona los valores predeterminados de país a idioma usados durante la generación de perfiles.",
      licenseLabel: "CC BY-SA 2.0",
      licenseUrl: "https://wiki.openstreetmap.org/wiki/Wiki_content_license",
      licenseBody: " se aplica al contenido de esa wiki, que se atribuye aquí.",
    },
    mapPreviewsPrefix: "Las vistas previas de mapas interactivos usan ",
    mapPreviewsMiddle: " servicios con ",
    mapPreviewsSuffix: " atribución de los colaboradores mostrada en el mapa.",

    localData: {
      title: "Conjuntos de datos locales",
      body: `${BRAND_DISPLAY_NAME} incluye pequeñas bases de datos locales creadas a partir de datos públicos procesados para que los valores simulados sean estadísticamente realistas. No se descarga nada de Internet: son instantáneas incluidas en la extensión y renovadas con cada actualización.`,
      steam: {
        label: "Encuesta de hardware y software de Steam",
        url: "https://store.steampowered.com/hwsurvey/",
        body: " (Valve) proporciona las distribuciones de resolución de pantalla, núcleos de CPU y RAM en Windows, Linux y macOS utilizadas para los perfiles de hardware locales.",
      },
      chromiumDash: {
        label: "ChromiumDash",
        url: "https://chromiumdash.appspot.com/",
        body: " proporciona las versiones reales de lanzamiento de Chrome utilizadas para User-Agent y Client Hints.",
      },
      localeCatalog: {
        prefix: "Los catálogos de configuración regional de ",
        mozilla: {
          label: "Mozilla",
          url: "https://github.com/mozilla-firefox/firefox/blob/main/intl/locale/language.properties",
        },
        middle: " y ",
        chromium: {
          label: "Chromium",
          url: "https://github.com/chromium/chromium/blob/main/ui/base/l10n/l10n_util.cc",
        },
        body: " proporcionan nombres de idioma adaptados a cada motor de navegador.",
      },
    },
  },

  projectLinks: {
    description: `${BRAND_DISPLAY_NAME} también vive fuera de la extensión. Visita el sitio web, explora el código o avísame cuando algo no funcione.`,
    websiteLabel: "Sitio web",
    websiteUrl: "https://privacything.com",
    sourceLabel: "Código fuente",
    sourceUrl: "https://github.com/Privacy-Thing/browser-extension",
    reportBugLabel: "Informar de un error",
    reportBugUrl:
      "https://github.com/Privacy-Thing/browser-extension/issues/new?template=bug_report.yml",
  },

  usage: {
    title: HOW_TO_USE_PRODUCT,
    body1:
      "Para obtener un punto de partida rápido y realista, comienza generando un perfil regional a partir de un lugar buscado.",
    body2: `Guarda un perfil regional por cada lugar real que quieras que ${BRAND_DISPLAY_NAME} imite y asigna los sitios web al perfil correspondiente.`,
    body3:
      "Usa la ventana emergente para asignar dominios rápidamente. Abre Configuración para acceder al panel completo de perfiles y reglas.",
    body4: `Explora Opciones y Avanzado cuando quieras más control sobre cómo ${BRAND_DISPLAY_NAME} se comporta.`,
  },
} as const;
