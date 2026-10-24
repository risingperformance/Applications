# PR Club

A gym training app that runs in the browser and installs to a phone's Home Screen.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole app |
| `manifest.webmanifest` | Name, colours and icons for the Home Screen app |
| `sw.js` | Offline support, so the app opens without signal |
| `icons/` | Home Screen and browser icons |

## Updating

Replace `index.html` with the new version and commit. Phones pick it up the next time the app is opened with signal (close and reopen it if the old version still shows).

## Data

Everything a person logs is stored on their own phone, never on GitHub. Use Settings › Back up regularly, and before changing phones.
