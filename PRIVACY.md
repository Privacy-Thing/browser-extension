# Privacy Policy for Privacy Thing

Last updated: October 14, 2026

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

Privacy Thing also includes an optional integration with Control D, a third-party DNS and traffic-routing service. It is off until you turn it on. If you turn it on and connect your own Control D account, Privacy Thing sends the hostnames of your domain rules, and the exit chosen for each, to Control D. See "Control D Integration" below.

## Data Processed by the Extension

Privacy Thing processes the following categories of data inside the browser:

- profiles you create, including profile name, coordinates, noise radius, language, languages, and time zone
- domain rules that connect websites or hostname patterns to your saved profiles
- local extension preferences, such as debug mode, panic mode state, and watch position delay
- temporary runtime values needed to apply the active profile to a page
- optional local debug logs, only when debug mode is enabled by the user
- if you turn on the optional Control D integration: your Control D API key, identifiers of the Control D resources Privacy Thing manages, the mapping between your profiles and Control D exits, and synchronization status

This data is stored locally using browser extension storage and is used only to operate the extension.

## Website Data Access

Privacy Thing runs on pages you choose to use with the extension so it can:

- apply the active location, locale, and time-zone profile to the page context
- align selected request headers, such as Accept-Language, with the active profile
- clear site state for a domain when you explicitly use the cleanup feature

Privacy Thing may access or affect page-level browser state such as cookies, local storage, IndexedDB, cache storage, and service workers, but only to apply extension features requested by the user. Privacy Thing does not transmit that website data to our own servers.

## Third-Party Services

Privacy Thing uses OpenStreetMap Nominatim and OpenFreeMap in two optional situations, and only after you grant consent inside the extension.

Control D is a separate, optional third-party service that is described in its own section below, "Control D Integration". It does not use the map and search consent described here.

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

## Control D Integration

Privacy Thing includes an optional integration with Control D, a third-party DNS and traffic-routing service. The integration is off until you turn it on in the Advanced section of the extension settings. It requires your own Control D account and an API key that you create there with write access.

When you connect your account, Privacy Thing asks your browser for permission to contact Control D. If you deny that permission, Privacy Thing makes no requests to Control D. Until you turn the integration on and connect an API key, Privacy Thing sends nothing to Control D.

### What Privacy Thing sends to Control D

After you connect, Privacy Thing sends the following to Control D to keep your Control D account in step with your regional rules:

- your Control D API key, as authorization for each request
- the hostnames from your domain rules that use a regional profile, together with the Control D exit chosen for each of them
- the names and identifiers of the resources it creates and manages: a profile, a browser endpoint, and one rule folder per exit. These names contain a random code generated by Privacy Thing and do not contain the names of your profiles
- a short comment on each rule that marks it as managed by Privacy Thing

Privacy Thing also reads from your Control D account the lists of your profiles, endpoints, rule folders, and rules, and Control D's catalogue of exit locations and services. It uses them to find the resources it manages and to prepare changes. These lists are processed in your browser and are not sent anywhere else.

Privacy Thing does not send the names or coordinates of your regional profiles, your browsing history, cookies, or page content to Control D.

As with any web request, Control D and its infrastructure providers can receive your IP address and standard browser request metadata when Privacy Thing contacts them.

### Service recognition lookups

If you use the optional service recognition feature, Privacy Thing also creates a separate lookup profile and endpoint in your Control D account, named with a random code like the other resources it manages. It then sends the hostname being checked, for example the site of a rule you are creating or editing, to Control D as a DNS-over-HTTPS lookup. The lookup tells Privacy Thing whether the hostname belongs to a Control D service. Your API key is included with that request, and Privacy Thing asks Control D not to log the lookup. Whether and how Control D logs requests is governed by Control D's own policy.

### Browser DNS

Privacy Thing does not change your browser's DNS settings and cannot see them. The integration shows you a Control D resolver address that you can choose to enter as your browser's Secure DNS provider. If you do, your browser sends its DNS queries, which include the hostnames of the websites you visit, to Control D. That is a choice you make in your browser settings, outside Privacy Thing, and Control D's policy applies to those queries.

Privacy Thing does not route your traffic itself and does not change your IP address by itself. Any change in where your traffic appears to come from is performed by Control D, and only if you use Control D as your DNS resolver.

### Your API key and disconnecting

Privacy Thing stores your API key only in this installation. It is excluded from exports and from browser sync.

You can disconnect in two ways. Disconnecting without deletion deletes the key and stops sending requests to Control D. It leaves what Privacy Thing created in your Control D account, meaning the profile, endpoint, rule folders, and rules, until you delete it there.

"Disconnect and delete what Privacy Thing created" first shows you what it would delete and what it would keep, and asks you to confirm. It deletes only resources that Privacy Thing recorded as its own and whose names and contents still match what it created. Resources that were renamed or changed, that Privacy Thing did not create, or that another endpoint still uses are kept. Before you confirm, change your browser's DNS provider away from the Control D resolver, because deleting the endpoint stops name resolution on any device still using it.

If a deletion fails, Privacy Thing stops syncing and keeps your API key and its records locally so that you can review and retry. It deletes the key when the cleanup finishes without failures, or when you choose to disconnect without deletion.

### Control D's own policy

How Control D handles the data it receives is governed by Control D's own terms and privacy policy:

https://controld.com/privacy

## Data Sharing

Privacy Thing does not sell or rent personal data.

Privacy Thing does not send your browsing history, rules, saved profiles, or extension settings to our own servers. If you turn on the optional Control D integration, the hostnames of your domain rules are sent to Control D, a third party, as described above.

Data may be disclosed to third parties only in the following limited cases:

- to OpenStreetMap Nominatim or OpenFreeMap when you voluntarily use the optional profile search or map features described above
- to Control D when you turn on the optional Control D integration and connect your own Control D account, as described in "Control D Integration"
- if required to comply with applicable law, regulation, legal process, or enforceable governmental request
- if necessary to protect the security, integrity, or operation of the extension or users

## Remote Code

Privacy Thing does not load or execute remote JavaScript or WebAssembly code. The executable extension code, map styles, CSS, and sprite assets are packaged with the extension itself.

## Data Retention

Extension settings and saved profiles remain in your browser until you edit, reset, or remove them, or uninstall the extension.

Optional debug logs remain only in local extension memory and can be cleared by the user. They are not sent to our servers.

Requests made to OpenStreetMap Nominatim and OpenFreeMap are governed by those services' own privacy and retention practices.

Your Control D API key remains in this installation until you disconnect or uninstall the extension. The profile, endpoint, rule folders, and rules that Privacy Thing creates in your Control D account remain there until you delete them in Control D or use "Disconnect and delete what Privacy Thing created". Requests made to Control D are governed by Control D's own privacy and retention practices.

## Your Choices

You can control your data by:

- creating, editing, or deleting profiles and rules
- granting or denying external map access when Privacy Thing asks for consent
- changing or withdrawing that consent later in the Advanced settings
- using or avoiding the optional profile generator search
- using or avoiding the embedded map view
- turning the optional Control D integration on or off, or disconnecting it
- denying the browser permission that Control D access requires
- deleting the resources that Privacy Thing created in your Control D account, either in Control D or with "Disconnect and delete what Privacy Thing created"
- choosing whether to use Control D as your browser's DNS resolver
- clearing domain state with the cleanup feature
- resetting extension settings
- uninstalling the extension

## Children's Privacy

Privacy Thing is not directed to children, and we do not knowingly collect personal data from children through our own services.

## Changes to This Policy

We may update this policy from time to time. The latest version should be published with the extension distribution or project repository.

## Contact

If you have questions about this policy or Privacy Thing's data practices, contact the publisher or repository owner for the current release of Privacy Thing.
