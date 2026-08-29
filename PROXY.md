# Hosting your own proxy

Everything painful about the current setup comes from one thing: Orion runs the proxy
*inside your browser*, using service workers and public "wisp" backends that keep dying.
Hosting your own proxy removes all of it. Then Orion just points a frame at your server —
one URL, no workers, no backends, no engines.

This is the CroxyProxy model: the server fetches the page, rewrites it, and serves it from
**your** domain, so your school filter sees only your Railway address.

---

## 1. Get the proxy code

Use **Ultraviolet-App** — it's the standard Node build and it already includes the server
half (the part your GitHub Pages sites are missing).

1. Go to <https://github.com/titaniumnetwork-dev/Ultraviolet-App>
2. Click **Fork** (top right) so it lands in your account.

> Your existing `PRUXYZ` and `Scramjet-App` repos are frontend-only. That's why they never
> worked: a proxy needs a server, and GitHub Pages can't run one.

---

## 2. Deploy it on Railway

1. Go to <https://railway.app> and sign in with GitHub.
2. **New Project → Deploy from GitHub repo → Ultraviolet-App**.
3. Railway detects Node and runs `npm start` on its own. You do **not** need to set a port —
   the app reads Railway's `PORT` variable.
4. Wait for the build (1–2 minutes).
5. Open the service → **Settings → Networking → Generate Domain**.
6. You get something like `https://ultraviolet-app-production-a1b2.up.railway.app`.

Open that URL. You should see the Ultraviolet home page with a search box. Type a site into
it — if it loads, your proxy works.

---

## 3. Point Orion at it

In Orion: **Orion VPN → Settings → Your own proxy**, and paste:

```
https://YOUR-APP.up.railway.app/service/%s
```

`%s` is where Orion puts the encoded address. Leave **How your proxy encodes URLs** on
**Ultraviolet (XOR)** — that's what this build uses.

That single field overrides everything else. Orion stops registering service workers and
stops probing public backends; it just builds a URL and loads it in a frame.

### Checking the prefix

Different builds use different paths. Open your proxy, put a site through its own search
box, and look at the address bar:

| Address bar shows | Put this in Orion |
| --- | --- |
| `.../service/abc123` | `https://YOUR-APP.up.railway.app/service/%s` |
| `.../uv/service/abc123` | `https://YOUR-APP.up.railway.app/uv/service/%s` |
| `.../scramjet/abc123` | `https://YOUR-APP.up.railway.app/scramjet/%s` + encoding **Plain** |

---

## 4. Things worth knowing

**Cost.** Railway's free trial credit runs out; after that a small always-on service is
roughly $5/month. Render and Fly.io have similar Node deployments if you'd rather not pay —
the Orion setting works with any of them, only the URL changes.

**Sleeping.** Free tiers idle the app after inactivity, so the first page load after a break
can take 10–30 seconds. That's the platform, not the proxy.

**Terms of service.** Hosting a proxy is legal and normal, but some hosts restrict open
proxies in their terms — if you leave it public and it gets heavy traffic it may be
suspended. Keep the URL to yourself.

**It won't fix everything.** Sites that need cross-origin isolation (threaded WASM) can
still break under Ultraviolet — `deadshot.io` is one. If a game misbehaves on your proxy,
deploy **Scramjet-Demo** instead (`https://github.com/MercuryWorkshop/Scramjet-Demo`), same
Railway steps, and set the encoding to **Plain**. You can keep both and switch the one field.

---

## 5. If it stops working

Run **Orion VPN → Settings → Proxy diagnostics → Run**. With a self-hosted proxy configured
it checks that one address and tells you whether it responded. If it didn't:

- Open the Railway URL directly in a normal browser tab — if that fails too, it's the
  deployment, not Orion (check Railway → Deployments → Logs).
- If the URL works in a tab but not in Orion, the prefix or encoding in the setting is wrong;
  compare against the table above.

Clearing the field puts Orion back on the in-browser engines.
