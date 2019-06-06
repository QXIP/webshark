<img src=https://user-images.githubusercontent.com/1423657/58752485-dd646c00-84af-11e9-94e9-c18529103638.png width=220>

# node-webshark
webShark for NodeJS

![image](https://user-images.githubusercontent.com/1423657/58755588-094f1400-84e7-11e9-9a3e-b2dfb27b6d74.png)

webShark is a Wireshark-like web user interface powered by [sharkd](https://wiki.wireshark.org/Development/sharkd) 

This projects aims at porting the original webshark python API and UI to NodeJS, as well as improving its capabilities and input methods to support PCAP storage backends APIs such as Stenographer and others.

## Status
Work in progress. Nothing to see.


## Instructions
### Build
Build a container with `sharkd` and `node-webshark` bundled
```
docker build -t webshark:latest .
```
#### Run
Mount your PCAP content directory to location `/capture` and launch
```
docker run -ti --rm -p 8085:8085 -v $(pwd)/captures:/captures webshark:latest
```
#### Test
Browse to your webshark instance, ie: `http://localhost:8085/webshark`

## Commands
### sharkd
Known commands are available on the [wiki](https://github.com/QXIP/node-webshark/wiki)

### Credits
This program is free software based on GPLv2 [webshark](https://bitbucket.org/jwzawadzki/webshark) by [Jakub Zawadzki](https://bitbucket.org/jwzawadzki). 

Dissections powered by tshark [sharkd](https://wiki.wireshark.org/Development/sharkd) from Wireshark Project. See [LICENSE](https://github.com/QXIP/node-webshark/blob/master/LICENSE) for details
