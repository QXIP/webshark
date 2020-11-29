<img src=https://user-images.githubusercontent.com/1423657/58752485-dd646c00-84af-11e9-94e9-c18529103638.png width=220>

# node-webshark

**webShark** is a *Wireshark-like* web user interface powered by [sharkd](https://wiki.wireshark.org/Development/sharkd) and featuring all its dissectors.

This projects implements the original webShark API in NodeJS, improving its capabilities and input methods to support PCAP storage backends APIs such as Stenographer and others.

![image](https://user-images.githubusercontent.com/1423657/100542883-351e9780-324d-11eb-8f10-28eb758245ea.png)


## Instructions
Mount your PCAP content directory to location `/captures` and launch webshark

#### Run with Compose
```
docker-compose up -d
```
#### Run Manually
```
docker run -ti --rm -p 8085:8085 -v $(pwd)/captures:/captures qxip/webshark
```
#### Test
Browse to your webshark instance, ie: `http://localhost:8085/webshark`

###### TCP Flows
![image](https://user-images.githubusercontent.com/1423657/59044920-5c2a2200-887f-11e9-8f5c-b227290f7806.png)

###### RTP Streams
![image](https://user-images.githubusercontent.com/1423657/59044655-d312eb00-887e-11e9-84f3-d8960d58fc05.png)


## Commands
#### sharkd
Known commands are available on the [wiki](https://github.com/QXIP/node-webshark/wiki)

#### Credits
This program is free software based on a fork of GPLv2 [webshark](https://bitbucket.org/jwzawadzki/webshark) by [Jakub Zawadzki](https://bitbucket.org/jwzawadzki) and sponsored by [QXIP](https://github.com/QXIP) and [CUBRO](http://cubro.com)

Dissections powered by tshark [sharkd](https://wiki.wireshark.org/Development/sharkd) from Wireshark Project. See [LICENSE](https://github.com/QXIP/node-webshark/blob/master/LICENSE) for details
