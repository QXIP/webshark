'use strict'
const fs = require('fs');
const fetch = require("node-fetch");
const sharkd_dict = require('../custom_module/sharkd_dict');
const CAPTURES_PATH = process.env.CAPTURES_PATH || "/captures/";

const download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  });
}


module.exports = function (fastify, opts, next) {

  fastify.register(require('fastify-static'), {
    root: CAPTURES_PATH,
    prefix: '/webshark//', // defeat unique prefix
  })

  fastify.get('/webshark/json', function (request, reply) {

    if (request.query && "req" in request.query) {
      if (request.query.req === 'files') {
        let files = fs.readdirSync(CAPTURES_PATH);
        let results = {"files":[], "pwd": "."};
        let loaded_files = sharkd_dict.get_loaded_sockets();
        files.forEach( async function(pcap_file){
          if (pcap_file.endsWith('.pcap')) {

	    if(pcap_file.startsWith('http:')){
		  const res = await fetch(pcap_file);
                  var filename = pcap_file.split('/').pop()
		  const fileStream = fs.createWriteStream(CAPTURES_PATH+filename);
		  await new Promise((resolve, reject) => {
		      res.body.pipe(fileStream);
		      res.body.on("error", reject);
		      fileStream.on("finish", resolve);
		    });
		  pcap_file=filename;
	    }

            let pcap_stats = fs.statSync(CAPTURES_PATH + pcap_file);
            if (loaded_files.includes(pcap_file)) {
              results.files.push({"name": pcap_file, "size": pcap_stats.size, "status": {"online": true}});
            } else {
              results.files.push({"name": pcap_file, "size": pcap_stats.size});
            }
          }
        });
        reply.send(JSON.stringify(results));
      } else if (request.query.req === 'download') {
        if ("capture" in request.query) {
          if (request.query.capture.includes('..')) {
            reply.send(JSON.stringify({"err": 1, "errstr": "Nope"}));
          }

          let cap_file = request.query.capture;
          if (cap_file.startsWith("/")) {
            cap_file = cap_file.substr(1);
          }

          if ("token" in request.query) {
            if (request.query.token === "self") {
              reply.header('Content-disposition', 'attachment; filename=' + cap_file);
              reply.sendFile(cap_file);
              next();
            } else {
              sharkd_dict.send_req(request.query).then((data) => {
                try {
                  data = JSON.parse(data);
                  reply.header('Content-Type', data.mime);
                  reply.header('Content-disposition', 'attachment; filename="' + data.file + '"');
                  let buff = new Buffer(data.data, 'base64');
                  reply.send(buff);
                } catch (err) {
                  reply.send(JSON.stringify({"err": 1, "errstr": "Nope"}));
                }
              });
            }
          } else {
            reply.send(JSON.stringify({"err": 1, "errstr": "Nope"}));
          }
        }
      } else if (
        request.query.req === 'tap' &&
        'tap0' in request.query && 
        ['srt:dcerpc', 'srt:rpc', 'srt:scsi', 'rtd:megaco'].includes(request.query.tap0) // catch the four invalid requests and prevent socket failure
      ) {
        reply.send(null);
      } else {
        sharkd_dict.send_req(request.query).then((data) => {
          reply.send(data);
        });
      }
    }
  })

  next()
}
