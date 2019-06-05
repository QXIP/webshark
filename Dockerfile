FROM node:8-stretch as intermediate

RUN apt-get update && apt-get install -y \
	git make python3 cmake flex bison libglib2.0-dev libgcrypt20-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN mkdir -p /out
RUN mkdir -p /usr/src
RUN mkdir -p /var/run

WORKDIR /usr/src

RUN git clone https://github.com/qxip/node-webshark /usr/src/node-webshark
RUN git clone https://code.wireshark.org/review/wireshark /usr/src/wireshark

WORKDIR /usr/src/wireshark
RUN ../node-webshark/sharkd/build.sh


FROM node:8-stretch

RUN apt update \
    && apt install git libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /captures
VOLUME /captures

RUN git clone --single-branch --branch master https://github.com/qxip/node-webshark /usr/src/node-webshark

WORKDIR /usr/src/node-webshark
RUN npm i -g browserify-lite && browserify-lite --standalone webshark ./web/js/webshark.js --outfile web/js/webshark-app.js

WORKDIR /usr/src/node-webshark/api
RUN npm install && npm audit fix

COPY --from=intermediate /out /out
RUN cd / && tar zxvf /out/sharkd.tar.gz && rm -rf /out/sharkd.tar.gz

RUN echo "#!/bin/bash" > /entrypoint.sh && echo "sharkd unix:/var/run/sharkd.sock && ps aux | grep sharkd && npm start" >> /entrypoint.sh && chmod +x /entrypoint.sh

RUN curl https://transfer.sh/YdgkZ/json-small.pcap -o /captures/json-small.pcap

EXPOSE 8085

ENTRYPOINT [ "/entrypoint.sh" ]
CMD [ "npm", "start" ]
