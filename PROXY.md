# Hosting your own proxy on Railway

## First, a correction

CroxyProxy is **closed source**. You can't self-host it, and "reflect4" isn't what it runs on
— that string appears on the page because CroxyProxy runs an **ad** for it:

```html
<a href="https://reflect4.me/register?utm_source=front_top_banner">
  Configure your personal web proxy for free…
```

`reflect4.me` is a separate hosted-proxy product being advertised. Signing up there is a fine
option if you just want a proxy without running one, but it isn't "building your own", and
it's not CroxyProxy's technology.

The closest thing you *can* host is **Rammerhead**, and for your use case it's actually a
better fit than the Ultraviolet setup we tried before.

## Why Rammerhead, not Ultraviolet

| | Ultraviolet / Scramjet | **Rammerhead** |
| --- | --- | --- |
| Where rewriting happens | In your browser, via a service worker | **On the server** |
| Works in an iframe | Only after the frame has loaded the proxy's own page and registered the worker | **Straight away** |
| What Orion needs | Service worker + BareMux + a live wisp backend | **Just a URL** |

Every failure you hit — "ServiceWorker script evaluation failed", dead wisp backends,
transport mismatches — came from doing the work in the browser. Rammerhead does it
server-side, like CroxyProxy does, so Orion only has to point a frame at it.

It's MIT licensed and built on testcafe-hammerhead.

---

## 1. Fork it

<https://github.com/binary-person/rammerhead> → **Fork**.

## 2. Add a config file

Railway gives you **one** port and terminates HTTPS in front of your app, so the defaults
(`127.0.0.1`, port `8080`, a second port `8081`) won't work unchanged.

Create **`config.js` in the repository root** — the project reads a root `config.js` as an
override of `src/config.js`, so you can still pull updates without merge conflicts.

```js
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 8080;

module.exports = {
    // Railway routes to the container, so listen on all interfaces
    bindingAddress: '0.0.0.0',
    port: PORT,
    // Only one public port is available. Rammerhead handles both roles on one
    // port and sets the CORS origin headers correctly when these match.
    crossDomainPort: PORT,
    publicDir: path.join(__dirname, 'public'),

    // Behind Railway's TLS terminator the client always talks HTTPS on 443,
    // which is what the rewritten URLs must point at - not the internal port.
    getServerInfo: (req) => ({
        hostname: new URL('http://' + req.headers.host).hostname,
        port: 443,
        crossDomainPort: 443,
        protocol: 'https:'
    }),

    // Set to a phrase of your own to stop strangers creating sessions.
    // null = anyone with the URL can use it.
    password: null,

    // Let Orion put proxied pages in a frame.
    rewriteServerHeaders: {
        'x-frame-options': null,
        'content-security-policy': null,
        'content-security-policy-report-only': null
    },

    // Real client IP is in the forwarded header behind a reverse proxy
    getIP: (req) =>
        (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '')
            .split(',')[0]
            .trim(),

    // School networks can shift your IP mid-session; leave false if sessions
    // keep dying on you.
    restrictSessionToIP: true
};
```

Commit that to your fork.

## 3. Deploy on Railway

1. <https://railway.app> → sign in with GitHub.
2. **New Project → Deploy from GitHub repo →** your Rammerhead fork.
3. Open the service → **Settings**, and set:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `node src/server.js`
   
   The build step is required — Rammerhead compiles its client scripts and won't run without it.
4. Needs **Node 16+**. Railway's default is newer, so nothing to do unless a build fails on
   the Node version, in which case add an `engines` field to `package.json`.
5. **Settings → Networking → Generate Domain.**

Open the domain. You should get the Rammerhead homepage with a URL box. Type a site in — if
it loads, you're done.

> If the build fights you (`npm-force-resolutions` in its `preinstall` can be fussy), there
> are maintained easy-deploy forks with Docker set up:
> [amethystnetwork-dev/Rammerhead](https://github.com/amethystnetwork-dev/Rammerhead) and
> [Quartinal/Rammerhead](https://github.com/Quartinal/Rammerhead).

## 4. Point Orion at it

**Orion VPN → Settings → Your own proxy**, paste just the base address:

```
https://YOUR-APP.up.railway.app
```

Set **How your proxy encodes URLs** to **Rammerhead (session)**.

Orion then does what the homepage does: calls `/newsession` once, keeps the id, and loads
pages at `https://YOUR-APP.up.railway.app/<session>/<url>`. That one setting bypasses all the
in-browser engine machinery.

Useful endpoints, if you ever want to script it: `/newsession`, `/sessionexists`,
`/editsession`, `/deletesession`, `/needpassword`, `/mainport`.

---

## Costs and caveats

- **Money.** Railway's trial credit runs out; a small always-on service is roughly **$5/month**.
  Rammerhead is heavier than Ultraviolet — it rewrites on the server — so don't expect the
  free tier to carry it for long. Render and Fly.io work with the same config.
- **Cold starts.** On idle-to-zero plans the first load after a break takes 10–30 seconds.
- **Terms of service.** Running a personal proxy is legal and normal, but most hosts have
  something to say about *open* proxies. Keep the URL private, or set `password` above.
- **Disk.** The `jsCache` default writes up to 5 GB to disk. On a small Railway volume, lower
  it or switch to the in-memory cache (`RammerheadJSMemCache`) — both are shown in
  `src/config.js`.
- **Not everything works.** Sites needing cross-origin isolation, DRM video (Netflix and
  friends), and aggressive bot detection still fail. That's true of CroxyProxy too.

## If it breaks

**Orion VPN → Settings → Proxy diagnostics → Run** checks the address you configured and
reports whether it answered. Beyond that:

- Open the Railway URL in a normal tab. Broken there too → it's the deployment; check
  **Railway → Deployments → Logs**.
- Pages load but assets 404 or CSS is missing → `getServerInfo` is returning the wrong
  hostname/port; it must report **443 / https:**, not the internal port.
- Sessions expire constantly → set `restrictSessionToIP: false`.
