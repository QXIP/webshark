FROM node:8-stretch as intermediate

ENV serial 202098761

RUN apt-get update && apt-get install -y \
	git make python3 cmake flex bison libglib2.0-dev libgcrypt20-dev libspeex-dev libc-ares-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN mkdir -p /out
RUN mkdir -p /usr/src
RUN mkdir -p /var/run

WORKDIR /usr/src

RUN git clone https://github.com/qxip/node-webshark /usr/src/node-webshark
RUN git clone https://github.com/wireshark/wireshark /usr/src/wireshark

WORKDIR /usr/src/wireshark
RUN ../node-webshark/sharkd/build.sh


FROM node:10-stretch

RUN apt update \
    && apt install -y git libglib2.0-0 speex libspeex-dev libc-ares2 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /captures
VOLUME /captures

COPY --from=intermediate /out /out
RUN cd / && tar zxvf /out/sharkd.tar.gz && rm -rf /out/sharkd.tar.gz

ENV CAPTURES_PATH=/captures/

# RUN git clone --single-branch --branch master https://github.com/qxip/node-webshark /usr/src/node-webshark
COPY . /usr/src/node-webshark

WORKDIR /usr/src/node-webshark
RUN npm i -g browserify-lite && browserify-lite --standalone webshark ./web/js/webshark.js --outfile web/js/webshark-app.js

WORKDIR /usr/src/node-webshark/api
RUN npm install && npm audit fix

RUN echo "#!/bin/bash" > /entrypoint.sh && \
    echo "CAPTURES_PATH=/captures/ npm start" >> /entrypoint.sh && chmod +x /entrypoint.sh
    
EXPOSE 8085

ENTRYPOINT [ "/entrypoint.sh" ]
CMD [ "npm", "start" ]
