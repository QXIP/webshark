<img src=https://user-images.githubusercontent.com/1423657/58752485-dd646c00-84af-11e9-94e9-c18529103638.png width=220>

# node-webshark
webShark for NodeJS

webShark is a Wireshark-like web user interface powered by [sharkd](https://wiki.wireshark.org/Development/sharkd). This projects aims at porting the original webshark API/UI to NodeJS and improve its capabilities and input methods to support PCAP storage backends APIs such as Stenographer and others.

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


### Credits
Based on [webshark](https://bitbucket.org/jwzawadzki/webshark) by [Jakub Zawadzki](https://bitbucket.org/jwzawadzki)
