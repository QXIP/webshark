# Build args
# WEBSHARK_UI_MODE=full|kiosk  — full shows file browser (#48); kiosk hides it for public demos
# WIRESHARK_REF — pinned Wireshark tag/commit for reproducible sharkd builds (#52)
# SHARKD_BUILD_JOBS — make -jN (default capped in build.sh)
ARG WIRESHARK_REF=v4.4.6
ARG WEBSHARK_UI_MODE=full
ARG WEBSHARK_UI_REF=1.0.4
ARG SHARKD_BUILD_JOBS=4

FROM node:20-bookworm AS intermediate

ARG WIRESHARK_REF
ARG WEBSHARK_UI_MODE
ARG WEBSHARK_UI_REF
ARG SHARKD_BUILD_JOBS

RUN apt-get update && apt-get install -y \
	git sed wget unzip make python3 cmake flex bison libglib2.0-dev libgcrypt20-dev libspeex-dev libspeexdsp-dev libc-ares-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN mkdir -p /out /usr/src /var/run
WORKDIR /usr/src

# Use build-context sharkd scripts (not an unpinned clone of this repo).
COPY sharkd /usr/src/node-webshark/sharkd

# Pin Wireshark so tip-of-tree dissectors do not break the image build (#52).
RUN git clone --depth 1 --branch "${WIRESHARK_REF}" https://gitlab.com/wireshark/wireshark.git /usr/src/wireshark

WORKDIR /usr/src/wireshark
ENV SHARKD_BUILD_JOBS=${SHARKD_BUILD_JOBS}
RUN ../node-webshark/sharkd/build.sh

# Build UI: default "full" (non-kiosk) so /webshark lists PCAPs (#48).
WORKDIR /usr/src
COPY scripts/vendor-offline-fonts.sh /usr/src/vendor-offline-fonts.sh
RUN chmod +x /usr/src/vendor-offline-fonts.sh \
 && git clone --depth 1 --branch "${WEBSHARK_UI_REF}" https://github.com/QXIP/webshark-ui.git /usr/src/webshark-ui \
 && cd /usr/src/webshark-ui \
 && npm ci \
 && if [ "${WEBSHARK_UI_MODE}" = "kiosk" ]; then npm run build:kiosk; else npm run build; fi \
 && mkdir -p /usr/src/web \
 && cp -a dist/webshark/. /usr/src/web/ \
 && sed -i 's|href="/"|href="/webshark/"|g' /usr/src/web/index.html \
 && /usr/src/vendor-offline-fonts.sh /usr/src/web


FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 speex libspeex1 libspeexdsp1 libc-ares2 libxml2 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /captures /usr/local/bin /usr/local/share/wireshark/ \
    && chown -R node: /captures

COPY --from=intermediate /usr/src/wireshark/build/run/sharkd /usr/local/bin/sharkd
COPY --from=intermediate /usr/src/wireshark/build/run/colorfilters /usr/local/share/wireshark/colorfilters

ENV CAPTURES_PATH=/captures/
ENV SHARKD_SOCKET=/captures/sharkd.sock

COPY --chown=node . /usr/src/node-webshark
COPY --from=intermediate /usr/src/web /usr/src/node-webshark/web

VOLUME /captures

WORKDIR /usr/src/node-webshark/api
RUN npm install --omit=dev

EXPOSE 8085
ENTRYPOINT [ "/usr/src/node-webshark/entrypoint.sh" ]
