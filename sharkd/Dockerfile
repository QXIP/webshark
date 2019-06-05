FROM node:8-stretch
MAINTAINER Jakub Zawadzki <darkjames-ws@darkjames.pl>
RUN apt-get update && apt-get install -y \
	git make python3 cmake flex bison libglib2.0-dev libgcrypt20-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN git clone https://code.wireshark.org/review/wireshark

COPY . ./sharkd

WORKDIR wireshark

CMD ["./../sharkd/build.sh"]
