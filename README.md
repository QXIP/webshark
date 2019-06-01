# node-webshark
webShark for NodeJS

This projects aims at porting the original webshark API to NodeJS and improve its capabilities and input methods.

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
