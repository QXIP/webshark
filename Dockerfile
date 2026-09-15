# UI build (Wiregasm WASM assets come from @goodtools/wiregasm)
ARG WEBSHARK_UI_MODE=full

FROM node:20-bookworm AS ui
ARG WEBSHARK_UI_MODE

RUN apt-get update && apt-get install -y --no-install-recommends git \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src
COPY scripts/vendor-offline-fonts.sh /usr/src/vendor-offline-fonts.sh
COPY ui /usr/src/webshark-ui
RUN chmod +x /usr/src/vendor-offline-fonts.sh \
 && cd /usr/src/webshark-ui \
 && npm ci \
 && if [ "${WEBSHARK_UI_MODE}" = "kiosk" ]; then npm run build:kiosk; else npm run build; fi \
 && mkdir -p /usr/src/web \
 && cp -a dist/webshark/. /usr/src/web/ \
 && sed -i 's|href="/"|href="/webshark/"|g' /usr/src/web/index.html \
 && /usr/src/vendor-offline-fonts.sh /usr/src/web

FROM node:20-bookworm-slim

RUN mkdir -p /captures \
    && chown -R node: /captures

ENV CAPTURES_PATH=/captures/
ENV UPLOAD_MAX_BYTES=2147483648

COPY --chown=node . /usr/src/node-webshark
COPY --from=ui /usr/src/web /usr/src/node-webshark/web

VOLUME /captures

WORKDIR /usr/src/node-webshark/api
RUN npm install --omit=dev

EXPOSE 8085
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:8085/webshark/json?method=files',r=>process.exit(r.statusCode>=400?1:0)).on('error',()=>process.exit(1))"
ENTRYPOINT [ "/usr/src/node-webshark/entrypoint.sh" ]
