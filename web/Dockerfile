FROM node:8-alpine

RUN apk update && apk add --no-cache git

WORKDIR /app
RUN git clone https://github.com/QXIP/node-webshark .
WORKDIR /app/api
RUN npm install && npm audit fix
USER node

CMD [ "npm", "start" ]
