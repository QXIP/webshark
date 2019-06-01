<img src=https://user-images.githubusercontent.com/1423657/58752485-dd646c00-84af-11e9-94e9-c18529103638.png width=220>

# node-webshark
webShark for NodeJS

webShark is a Wireshark-like web user interface powered by [sharkd](https://wiki.wireshark.org/Development/sharkd) 

This projects aims at porting the original webshark python API and UI to NodeJS, as well as improving its capabilities and input methods to support PCAP storage backends APIs such as Stenographer and others.

## Status
Work in progress. Nothing to see.


## Build Notes
### sharkd
```
docker build -t sharkd:latest sharkd/
docker run -v `pwd`:/out:/out --rm -it sharkd:latest
```
### webui
```
browserify-lite --standalone webshark ./web/js/webshark.js --outfile web/js/webshark-app.js
```

## Commands
### sharkd
Known commands are available on the [wiki](https://github.com/QXIP/node-webshark/wiki)

### Credits
This program is free software based on GPLv2 [webshark](https://bitbucket.org/jwzawadzki/webshark) by [Jakub Zawadzki](https://bitbucket.org/jwzawadzki). 

Dissections powered by tshark [sharkd](https://wiki.wireshark.org/Development/sharkd) from Wireshark Project. See [LICENSE](https://github.com/QXIP/node-webshark/blob/master/LICENSE) for details
