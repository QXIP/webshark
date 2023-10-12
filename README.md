<img src=https://github.com/RFbkak37y3kIY/webshark/assets/1423657/e769fcbf-d83b-4d07-8e86-c9b5706ad5ee width=250>

# node-webshark

**webShark** is a *Wireshark-like* web user interface powered by [sharkd](https://wiki.wireshark.org/Development/sharkd) and featuring all its dissectors.

This projects implements the original webShark API in NodeJS, improving its capabilities and input methods to support PCAP storage backends APIs such as Stenographer and others.

![image](https://github.com/RFbkak37y3kIY/webshark/assets/1423657/491054ae-a2e7-4570-8133-a88eb3bd49d5)



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
This program is free software based on a fork of GPLv2 [webshark](https://bitbucket.org/jwzawadzki/webshark) by [Jakub Zawadzki](https://bitbucket.org/jwzawadzki) and sponsored by [qxip](https://github.com/QXIP)

Dissections powered by tshark [sharkd](https://wiki.wireshark.org/Development/sharkd) from Wireshark Project. See [LICENSE](https://github.com/QXIP/node-webshark/blob/master/LICENSE) for details
