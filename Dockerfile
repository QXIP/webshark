FROM node:20-bookworm as intermediate

ENV serial 202098761

RUN apt-get update && apt-get install -y \
	git make python3 cmake flex bison libglib2.0-dev libgcrypt20-dev libspeex-dev libspeexdsp-dev libc-ares-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN mkdir -p /out
RUN mkdir -p /usr/src
RUN mkdir -p /var/run

WORKDIR /usr/src

RUN git clone --depth=1 https://github.com/qxip/node-webshark.git /usr/src/node-webshark
RUN git clone --depth=1 https://gitlab.com/wireshark/wireshark.git /usr/src/wireshark

WORKDIR /usr/src/wireshark
RUN ../node-webshark/sharkd/build.sh


FROM node:20-bookworm

RUN apt update \
    && apt install -y git libglib2.0-0 speex libspeex1 libspeexdsp1 libc-ares2 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /captures
VOLUME /captures

COPY --from=intermediate /out /out
RUN cd / && tar zxvf /out/sharkd.tar.gz && rm -rf /out/sharkd.tar.gz

ENV CAPTURES_PATH=/captures/

COPY --chown=node . /usr/src/node-webshark

USER node

WORKDIR /usr/src/node-webshark/api
RUN npm install && npm audit fix

EXPOSE 8085
ENTRYPOINT [ "/usr/src/node-webshark/entrypoint.sh" ]
