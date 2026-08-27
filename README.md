# Windows 11 Emulator

A Windows 11 desktop environment that runs entirely in the browser — window manager,
taskbar, Start menu, file system and a working **Microsoft Edge** browser. Pure static
HTML/CSS/JS with no build step and no dependencies, so it drops straight onto GitHub Pages.

> This is an independent **simulation** of the Windows 11 interface. It is not affiliated
> with Microsoft, contains no Microsoft code or assets, and nothing is virtualised.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Pick the `main` branch and the `/ (root)` folder, then save.
4. Your emulator is live at `https://<user>.github.io/<repo>/`.

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

**Microsoft Edge** — the centrepiece:

- Tab strip built into the title bar: new, close, switch, middle-click to close
- Omnibox with live suggestions from history, favourites and the site index
- Back/forward history per tab, refresh, home, favourites bar, progress bar
- `edge://newtab`, `history`, `favorites`, `downloads`, `settings`, `version`
- A small **simulated web** that always loads: `bing.local` (search), `docs.emu`,
  `news.emu`, `weather.emu`, `about.emu` and `games.emu` (playable Minesweeper)
- **Real websites** load in an iframe. Most refuse to be framed (`X-Frame-Options`),
  so the error page offers *Open in system browser* — `example.com` works as a live demo
- Downloads write real files into the virtual file system

**Apps** — File Explorer (create, rename, copy, delete, grid/list views, search),
Notepad (opens and saves real files), Settings (wallpaper, accent, light/dark,
transparency, account), Calculator (keyboard driven), Terminal (`dir`, `cd`, `type`,
`echo >`, `mkdir`, `tree`, `start`, `ipconfig`, …), Photos, Microsoft Store and
Task Manager.

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
| `F5`, `Alt`+`←` `→` | Reload, back, forward (Edge) |

On Windows the `Win` key is captured by the real OS — use the taskbar button instead.

## Layout

```
index.html          shell markup
styles/             base tokens, shell, window chrome, app styles
js/icons.js         inline SVG icon set
js/state.js         settings, persistence, events, utilities
js/vfs.js           virtual file system
js/wm.js            window manager
js/shell.js         taskbar, Start, flyouts, Task View, context menus
js/apps/            edge, explorer, notepad, settings, calculator, terminal, extras
assets/             SVG wallpapers
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
