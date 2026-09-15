<img src=https://github.com/RFbkak37y3kIY/webshark/assets/1423657/e769fcbf-d83b-4d07-8e86-c9b5706ad5ee width=180>

# webshark-ng

**webShark** is a Wireshark-like web app. Packet dissection runs **in the browser** with [Wiregasm](https://github.com/goodstemy/wiregasm) (`@goodtools/wiregasm` 1.9.1, Wireshark 4.4.5 WASM). Fastify is only the origin plus optional PCAP storage.

<img src="https://github.com/QXIP/webshark/assets/1423657/092c2544-f5db-4a79-b3da-d48df4e0813c" width=600 />

> RTP playback uses ffmpeg WASM. That needs SharedArrayBuffer (localhost or HTTPS with COOP/COEP).

Accepts `.pcapng`, `.pcap`, and `.cap`.

LAN/kiosk deployments stay unauthenticated in v1. Treat `/captures` as trusted local files; do not expose the API to the public internet without a reverse-proxy auth layer.

## Architecture

| Layer | Role |
| --- | --- |
| **Browser** | Wiregasm worker loads the capture into WASM memory and answers frames, details, filters, I/O graph, Follow Stream, VoIP Calls, RTP Streams/Analyze/Player, conversations, endpoints, export objects. |
| **Fastify (`:8085`)** | Serves the UI, lists/uploads/downloads files under `CAPTURES_PATH`, live-follows growing files over SSE. It does **not** run `sharkd` or dissect packets. |
| **Static / GitHub Pages** | Same UI with `clientOnly: true`. No API. Users open PCAPs from disk; nothing is uploaded. |

## Run with storage (Docker)

Mount a capture directory at `/captures` and start the API + UI:

```bash
docker-compose up -d
# or
docker run -ti --rm -p 8085:8085 -v $(pwd)/captures:/captures ghcr.io/qxip/webshark:latest
```

Open [http://localhost:8085/webshark](http://localhost:8085/webshark).

### Local dev

```bash
npm --prefix ui ci
npm --prefix api ci
export CAPTURES_PATH=$(pwd)/captures/
npm run build:ui
npm --prefix api run dev
```

### Shareable links

```
http://localhost:8085/webshark/?capture=voip.pcapng&frame=12&filter=sip&view=rtp
```

Query keys: `capture`, `frame`, `filter`, `view` (`rtp` | `voip` | `flow` | `follow` | `iograph` | `expert`), `stream` (RTP 5-tuple token), `follow`, `embed=1`.

**File** menu: Open a local capture, close, export displayed/filtered packets as classic PCAP, download the original file, export HTTP/TFTP/SMB objects. Click **WebShark** in the header to return to the open-capture screen.

Growing files (`tcpdump -w` / `dumpcap` writing into `/captures`) are followed over `GET /webshark/watch` (SSE). The packet list appends; dissection still happens in WASM.

## Static / GitHub Pages (client-only)

No server and no capture storage. Drop a PCAP in the page; Wiregasm dissects it locally.

```bash
npm --prefix ui run build:static
# output: ui/dist/webshark

npm --prefix ui start -- --configuration static   # local preview
```

Pushing to `main`/`master` publishes that build to GitHub Pages (`.github/workflows/github-pages.yml`). Enable **Settings → Pages → Source: GitHub Actions** once. The base href is `/<repo>/` (or `/` for `user.github.io` repos).

RTP playback still needs SharedArrayBuffer (HTTPS + the bundled COOP/COEP service worker).

## Embed / iframe

Kiosk build (`WEBSHARK_UI_MODE=kiosk`) hides the file browser. Embed with `embed=1` or `/webshark/embed/<view>`:

```html
<iframe
  src="http://localhost:8085/webshark/?capture=voip.pcapng&view=rtp&embed=1"
  style="width:100%;height:100%;border:0"
  allow="fullscreen"
></iframe>
```

Hosts that iframe webshark should set `Content-Security-Policy: frame-ancestors` on their own origin.

## API (storage only)

The UI talks to Wiregasm in-process. The API is file I/O:

| Method | Purpose |
| --- | --- |
| `GET /webshark/json?method=files` | List captures |
| `GET /webshark/captures/:name` | Raw PCAP bytes for the worker |
| `POST /webshark/upload` | Store an upload under `CAPTURES_PATH` |
| `GET /webshark/watch?capture=…` | SSE `capture-changed` `{size,mtime,kind}` (`init` \| `append` \| `full`) |

Dissection methods (`frames`, `frame`, `tap`, `follow`, …) are rejected. Uploads stream to disk (`UPLOAD_MAX_BYTES`, default 2 GiB).

### Stenographer

Set `STENOGRAPHER_URL` to pull a remote PCAP into `CAPTURES_PATH`:

```bash
curl -X POST http://localhost:8085/webshark/stenographer \
  -H 'content-type: application/json' \
  -d '{"query":"port 5060 and after 1m ago","name":"sip-last-minute.pcap"}'
```

Status: `GET /webshark/stenographer/status`

## Tests

```bash
npm test
# or
npm --prefix api test
npm --prefix ui test
```

## Docker build

| Arg | Default | Purpose |
| --- | --- | --- |
| `WEBSHARK_UI_MODE` | `full` | `full` shows the capture list; `kiosk` hides it |

```bash
docker build --build-arg WEBSHARK_UI_MODE=full -t webshark .
```

The image builds the Angular UI (and Wiregasm WASM assets) in a Node stage. It does not compile `sharkd`.

## Credits

> GPLv2 fork of [webshark](https://bitbucket.org/jwzawadzki/webshark) by [Jakub Zawadzki](https://bitbucket.org/jwzawadzki), sponsored by [qxip](https://github.com/QXIP).

> Dissection in the browser is [Wiregasm](https://github.com/goodstemy/wiregasm) / Wireshark. See [LICENSE](LICENSE).
