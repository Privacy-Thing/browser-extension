# Privacy Policy for Privacy Thing

Last updated: April 23, 2026

Privacy Thing is a browser extension for per-domain location spoofing and anti-fingerprinting. This policy explains what data Privacy Thing processes, when that happens, and when data may be sent to third-party services.

## Summary

Privacy Thing stores your profiles, rules, and related settings locally in your browser so the extension can apply them to selected websites.

Privacy Thing does not sell your data, does not use your data for advertising, and does not send your browsing data to our own servers.

Privacy Thing can use third-party map and search services only if you explicitly allow that communication in the extension. External map access is optional and disabled until you grant consent. If you do not grant consent, Privacy Thing does not send those requests.

If you grant consent, those services are used only in these optional UI features:

- when you use the profile generator search, your search query is sent to the OpenStreetMap Nominatim service to resolve a place into coordinates and related location metadata
- when you open the map in the profile editor or generator, vector tiles and fonts are loaded from OpenFreeMap for interactive previews
- when you open the Playground and use the location preview map, vector tiles and fonts are loaded from OpenFreeMap for the coordinates of the spoofed location you selected
- the executable map code, CSS, style JSON, and sprite assets remain bundled locally inside the extension package rather than loaded from a remote CDN

## Data Processed by the Extension

Privacy Thing processes the following categories of data inside the browser:

- profiles you create, including profile name, coordinates, noise radius, language, languages, and time zone
- domain rules that connect websites or hostname patterns to your saved profiles
- local extension preferences, such as debug mode, panic mode state, and watch position delay
- temporary runtime values needed to apply the active profile to a page
- optional local debug logs, only when debug mode is enabled by the user

This data is stored locally using browser extension storage and is used only to operate the extension.

## Website Data Access

Privacy Thing runs on pages you choose to use with the extension so it can:

- apply the active location, locale, and time-zone profile to the page context
- align selected request headers, such as Accept-Language, with the active profile
- clear site state for a domain when you explicitly use the cleanup feature

Privacy Thing may access or affect page-level browser state such as cookies, local storage, IndexedDB, cache storage, and service workers, but only to apply extension features requested by the user. Privacy Thing does not transmit that website data to our own servers.

## Third-Party Services

Privacy Thing uses OpenStreetMap Nominatim and OpenFreeMap in two optional situations, and only after you grant consent inside the extension.

You can grant that consent when Privacy Thing first asks before using the profile generator or map features. You can also change your decision later in the Advanced section of the extension settings. If you withdraw consent, Privacy Thing stops making new external map and search requests until you allow them again.

### 1. Profile Generator Search

If you use the "Generate profile" feature and search for a city, address, or place name, Privacy Thing sends your search query to the OpenStreetMap Nominatim service.

That request may allow OpenStreetMap or its infrastructure providers to receive information such as:

- your search text
- your IP address
- standard browser and request metadata
- request timing and diagnostic data

Privacy Thing uses the returned result only to help you create a local profile draft in the extension.

### 2. Embedded Map Previews

If you open the map view in the profile generator or profile editor, Privacy Thing loads vector tiles and fonts from OpenFreeMap. As with normal web requests, this may expose your IP address and standard browser request metadata to OpenFreeMap or its infrastructure providers.

The interactive map in the Playground page uses the same OpenFreeMap-backed preview once consent is already granted or you grant it when prompted. In this context, the request exposes only the coordinates of the spoofed location you selected, your IP address, and standard browser request metadata to OpenFreeMap or its infrastructure providers. No real device location data is involved in this request — only the saved spoofed coordinates from your chosen location profile.

## Data Sharing

Privacy Thing does not sell or rent personal data.

Privacy Thing does not send your browsing history, rules, saved profiles, or extension settings to our own servers.

Data may be disclosed to third parties only in the following limited cases:

- to OpenStreetMap Nominatim or OpenFreeMap when you voluntarily use the optional profile search or map features described above
- if required to comply with applicable law, regulation, legal process, or enforceable governmental request
- if necessary to protect the security, integrity, or operation of the extension or users

## Remote Code

Privacy Thing does not load or execute remote JavaScript or WebAssembly code. The executable extension code, map styles, CSS, and sprite assets are packaged with the extension itself.

## Data Retention

Extension settings and saved profiles remain in your browser until you edit, reset, or remove them, or uninstall the extension.

Optional debug logs remain only in local extension memory and can be cleared by the user. They are not sent to our servers.

Requests made to OpenStreetMap Nominatim and OpenFreeMap are governed by those services' own privacy and retention practices.

## Your Choices

You can control your data by:

- creating, editing, or deleting profiles and rules
- granting or denying external map access when Privacy Thing asks for consent
- changing or withdrawing that consent later in the Advanced settings
- using or avoiding the optional profile generator search
- using or avoiding the embedded map view
- clearing domain state with the cleanup feature
- resetting extension settings
- uninstalling the extension

## Children's Privacy

Privacy Thing is not directed to children, and we do not knowingly collect personal data from children through our own services.

## Changes to This Policy

We may update this policy from time to time. The latest version should be published with the extension distribution or project repository.

## Contact

If you have questions about this policy or Privacy Thing's data practices, contact the publisher or repository owner for the current release of Privacy Thing.
