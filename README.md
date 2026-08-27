# Orion

Orion is a desktop environment that runs entirely in the browser — window manager, taskbar,
Start menu, file system, a browser with its own rendering engine, a relay VPN and a store that
installs real web games. Pure static HTML/CSS/JS, no build step, no dependencies.

> Orion is an independent **simulation** of a Windows 11 style desktop. It is not affiliated with
> Microsoft, contains no Microsoft code or assets, and nothing is virtualised.

**Live: <https://chezburgar.github.io/win11/>**

## Deploy to GitHub Pages

Already deployed from `main` at the repository root. Any push to `main` republishes it —
there is no build step or workflow to wait on beyond the Pages deploy itself.

To set this up on a fresh fork or repo:

1. Push this folder to a GitHub repository.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Pick the `main` branch and the `/ (root)` folder, then save.

Everything is relative-path based, so it works from a subdirectory. `.nojekyll` is
included so Pages serves the files untouched.

### Run locally

```bash
node server.js
```

Then open <http://localhost:4173>. Opening `index.html` directly from disk works too —
all scripts are classic (non-module) for exactly that reason.

## What's in it

**Shell** — boot and lock screens, centred taskbar with running indicators, Start menu
with pinned/all apps and Recommended, search, Widgets board, Quick Settings, Notification
Centre with a live calendar, Task View with virtual desktops, Windows 11 style context
menus, and toast notifications.

**Window manager** — drag, resize from eight edges, minimise/maximise/restore, focus and
z-order, edge snapping, Snap Layouts on maximise-button hover, and modal dialogs.

**Microsoft Edge** — the browser opens pages two different ways, because one size does not fit all:

- **App mode (default)** loads the real site in a frame with `pointer-lock`, `fullscreen`,
  `gamepad`, `autoplay` and clipboard delegated to it. The site runs its own JavaScript, so
  games, WebGL and web apps work properly.
- **Engine mode** fetches the document over Orion's own network stack and renders it here:

```
fetch → parse (DOMParser) → strip scripts/frames → rewrite every URL → paint into a shadow root
```

- Scripts, iframes, objects and inline event handlers are removed before anything renders;
  password fields on remote pages are disabled on purpose
- Links, forms, images and CSS `url()`s are rewritten to absolute URLs; clicking a link
  navigates *inside* the emulator, and GET forms (site search boxes) work
- The page's own stylesheets are fetched and injected afterwards, so layout progressively
  sharpens — shadow DOM keeps that CSS from leaking into the desktop
- **Three render modes**: App (default), Engine, Reader — switchable per site and remembered
- The engine falls through several public relays, since any one of them may be rate limited
- Find on page (`Ctrl+F`) with match counts, zoom, `view-source:`, and `edge://net` internals
- Tabs in the title bar, per-tab history and zoom, favourites, downloads, page cache
- `edge://` pages: `newtab`, `history`, `favorites`, `downloads`, `settings`, `net`, `version`

**Search actually searches.** Results come from three live providers, combined:
DuckDuckGo's instant-answer API and Wikipedia's search API (both CORS-open, no relay
needed) plus full web results via the reader relay. Clicking a result opens that real page.

**Orion VPN** — a Windows-style VPN client with a connect orb, server list, session timer,
kill switch, protocol picker and tray indicator. Read this part carefully:

> The tunnel is **real in one specific sense**: it changes how the browser fetches pages,
> routing them through a public relay so sites that block cross-origin reads still load.
> It is **not** encryption, **not** anonymity, and it does **not** hide your IP. The relay
> operator can see which URLs you request. The app says this before it will connect, and
> sign-in fields are disabled on relayed pages.

**Orion Store** — installs real web games as desktop apps. An installed game gets its own icon,
window, desktop shortcut and Start tile, and comes back after a reload. It ships with
**Breach**, **Rythem** and **Hollow Knight**, and **Add by URL** installs any other web game
you point it at. Games run in a real frame with `pointer-lock`, `fullscreen`, `gamepad` and
autoplay delegated, so their own code, WebGL and audio work at full speed.

**Apps** — File Explorer (create, rename, copy, delete, grid/list views, search),
Notepad (opens and saves real files), Settings (wallpaper, accent, light/dark,
transparency, account), Calculator (keyboard driven), Terminal (`dir`, `cd`, `type`,
`echo >`, `mkdir`, `tree`, `start`, `ipconfig`, …), Photos and Task Manager.

**Storage** — a virtual file system and all settings persist in `localStorage`.
Nothing leaves the browser. *Settings → Privacy & security → Reset* wipes it.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Win` | Start menu |
| `Win`+`D` / `E` / `S` | Show desktop / Explorer / Search |
| `Win`+`Tab` | Task View |
| `Win`+`A` / `N` / `W` | Quick Settings / Notifications / Widgets |
| `Win`+`←` `→` `↑` `↓` | Snap, maximise, minimise |
| `Alt`+`Tab` / `Alt`+`F4` | Switch / close window |
| `Ctrl`+`T` / `W` / `L` | New tab / close tab / address bar (Edge) |
| `Ctrl`+`F` | Find on page (Edge) |
| `Ctrl`+`+` / `-` / `0` | Zoom in / out / reset (Edge) |
| `F5`, `Alt`+`←` `→` | Reload, back, forward (Edge) |

On Windows the `Win` key is captured by the real OS — use the taskbar button instead.

## Layout

```
index.html          shell markup
styles/             base tokens, shell, window chrome, app and game styles
js/icons.js         inline SVG icon set
js/state.js         settings, persistence, events, utilities
js/net.js           relays, page fetching, HTML sanitising/rewriting, search
js/vfs.js           virtual file system
js/wm.js            window manager
js/games.js         installable web games + the Store catalogue
js/shell.js         taskbar, Start, flyouts, Task View, context menus
js/apps/            edge, vpn, store, explorer, notepad, settings, calculator, terminal, extras
assets/             Orion logos and SVG wallpapers
server.js           local preview server (not needed for Pages)
```

Adding an app is one call — see any file in `js/apps/`:

```js
Emu.registerApp({
  id: 'myapp', name: 'My App', icon: 'file', pinned: true,
  launch: function (args) {
    var win = WM.create({ appId: 'myapp', title: 'My App', icon: 'file' });
    win.body.innerHTML = '<div class="pane">Hello</div>';
    return win;
  }
});
```

## Deploying changes

Stylesheets and scripts are linked with a `?v=N` query string in `index.html`. Bump that
number whenever you push, or returning visitors keep running the cached copy for up to ten
minutes after a deploy.

## Branding

The Orion mark and the Orion Store bag are hand-authored SVG in `assets/orion.svg` and
`assets/orion-store.svg`, redrawn from the supplied artwork so they stay crisp at every size
and can be tinted by the theme. They are also the favicon, the boot logo and the Start button.
Drop replacement files at those paths to swap the artwork without touching any code.
