<img src=https://github.com/RFbkak37y3kIY/webshark/assets/1423657/e769fcbf-d83b-4d07-8e86-c9b5706ad5ee width=180>

# webshark-ng

**webShark** is a *Wireshark-like* webapp powered by [sharkd](https://wiki.wireshark.org/Development/sharkd) and all its dissectors 🕵️

<img src="https://github.com/QXIP/webshark/assets/1423657/092c2544-f5db-4a79-b3da-d48df4e0813c" width=600 />

> Client-Side RTP playback powered by WASM/ffmpeg 🚀

<br>

## Instructions
Mount your PCAP content directory to location `/captures` and launch webshark

#### Run with Compose
```
docker-compose up -d
```
#### Run Manually
```
docker run -ti --rm -p 8085:8085 -v $(pwd)/captures:/captures ghcr.io/qxip/webshark:latest
```
#### Usage
Browse to your webshark-ng instance, ie: `http://localhost:8085/webshark`

#### Build options
Docker image build args:

| Arg | Default | Purpose |
|-----|---------|---------|
| `WEBSHARK_UI_MODE` | `full` | `full` shows the PCAP file browser; `kiosk` hides it (public demos) |
| `WIRESHARK_REF` | `v4.4.6` | Pinned Wireshark tag for reproducible `sharkd` builds |
| `SHARKD_BUILD_JOBS` | `4` | `make -jN` parallelism (raise only if the builder has enough RAM) |
| `WEBSHARK_UI_REF` | `1.0.4` | webshark-ui git tag |

Example:
```bash
docker build --build-arg WEBSHARK_UI_MODE=full --build-arg WIRESHARK_REF=v4.4.6 -t webshark .
```

Offline UI fonts (Roboto / Material Icons) are vendored under `web/fonts/` so the UI works without CDN access.

#### Large PCAP uploads
Uploads are streamed to disk via multipart. Files larger than ~2GB no longer crash Node's `fs.write` integer limit.

#### Stenographer (#42)
Set `STENOGRAPHER_URL` (e.g. `https://steno.example.com:1234`) to enable remote queries:

```bash
curl -X POST http://localhost:8085/webshark/stenographer \
  -H 'content-type: application/json' \
  -d '{"query":"port 5060 and after 1m ago","name":"sip-last-minute.pcap"}'
```

Status: `GET /webshark/stenographer/status`

#### Wiregasm (#41)
Browser-side WASM (`wiregasm`) as a sharkd replacement is not bundled yet — it needs a separate UI/runtime path. Track progress in [issue #41](https://github.com/QXIP/webshark/issues/41).

<br>

#### Credits
> This program is free software based on a fork of GPLv2 [webshark](https://bitbucket.org/jwzawadzki/webshark) by [Jakub Zawadzki](https://bitbucket.org/jwzawadzki) and sponsored by [qxip](https://github.com/QXIP)

> Dissections powered by tshark [sharkd](https://wiki.wireshark.org/Development/sharkd) from Wireshark Project. See [LICENSE](https://github.com/QXIP/node-webshark/blob/master/LICENSE) for details
