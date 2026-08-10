See more. Share less.

Websites can learn far more about your browser than what you type into a form. They may read your geolocation, language, time zone, screen size, hardware characteristics, and other details about your environment. Even graphics information exposed through WebGL can become part of a recognizable browser fingerprint.

Privacy Thing gives you practical control over this layer of privacy. It shows which browser information and features the page open in your browser accesses, then lets you decide which selected information it can see — separately for every website.

TL;DR
==================================================

1. Privacy Thing lets you control the information your browser shares with websites and web apps.
2. See which information a site used and how many times.
3. Create multiple sets of rules, separately for every website.
4. Create multiple location setups based on geographic position, available languages, and regional preferences. Privacy Thing includes a full-featured GPS-location spoofer with a realistic location-simulation model.
5. Privacy Thing is built to provide as much functionality as possible without connecting to external services. Your settings remain yours.

What Privacy Thing gives you
==================================================

1. Reduce selected parts of your “digital fingerprint”

Depending on the browser and configuration, Privacy Thing can control or modify selected information related to the browser, screen, and hardware, as well as canvas, WebGL, audio, WebRTC, frames, and workers. This also includes some data that may reveal characteristics of the graphics hardware.

Privacy Thing gives you a concrete set of tools for limiting and organizing information that falls within the extension’s reach.

2. See what a site checks

X-Ray, the built-in diagnostics panel, shows whether a site has accessed geolocation, language, screen data, canvas, WebGL, audio, WebRTC, or selected worker mechanisms. You can also see which profile was applied and whether any supported category encountered a problem.

It is not a complete record of everything a website does. It is a practical view of the browser areas Privacy Thing can recognize and control.

3. Set your own rules for every website

Create profiles and assign them to domains or domain patterns. Use a default rule, add exceptions for particular sites, and temporarily switch Privacy Thing off without deleting your configuration. You can also use the extension only on selected websites — Privacy Thing does not restrict you to one operating model.

4. Build coherent regional profiles

A profile can combine coordinates, geolocation accuracy and coordinate-variation radius, a primary language, a language list, and a time zone. The first-run wizard lets you quickly choose ready-made regional presets, while your own profiles remain freely editable.

The Refract engine can align the Geolocation API, navigator.language, navigator.languages, Date, Intl, and Accept-Language. A site does not have to see a random mixture of a location from one country, a language from another, and a time zone from somewhere else.

5. Use realistic data without unnecessary network requests

Every Privacy Thing release includes compact local data catalogs built from processed public datasets. Using these catalogs, the extension can independently choose statistically plausible hardware profiles with suitable screen resolutions, CPU-core counts, and available-memory values without making additional requests.

Privacy Thing can also rotate the browser version visible to a website, using a catalog of real Chromium releases. The extension additionally includes catalogs of browser-supported language codes and official languages.

These datasets ship with the extension and are refreshed periodically through updates. Privacy Thing does not need to query their sources during normal profile use. A time zone can also be determined locally from coordinates.

6. Clear data for a selected website

Privacy Thing can clear data for the current domain, including cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, and service workers. This is useful both for privacy and for testing a website from a clean state. Once the operation finishes, the profile receives an entirely different set of parameters, which should make it significantly harder for the site to track activity.

Your data. Your call.
==================================================

Profiles, rules, and settings are stored locally in your browser. Core features require no Privacy Thing account or backend. The extension does not collect its own telemetry and does not sell data.

Ready-made presets, bundled catalogs, and manually entered coordinates work without requests to map services. Only when you choose to enable place search or map previews does Privacy Thing use OpenStreetMap Nominatim and OpenFreeMap. You can change that choice later.

Privacy works in layers
==================================================

Privacy Thing controls selected information read directly through browser interfaces. It does not change your public IP address, route or encrypt traffic, or replace a VPN, proxy, or Smart DNS service.

Those tools address different parts of the problem and can complement one another. A VPN, proxy, or Smart DNS works at the network or name-resolution layer; Privacy Thing focuses on what a website can see through browser APIs.

Privacy Thing does not guarantee anonymity or undetectability. Websites may also rely on your IP address, account data, sessions, and other information beyond the extension's control. X-Ray reports activity only for supported features — it is not a complete audit of everything a website does.
