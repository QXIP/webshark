'use strict'
const fs = require('fs');
const sharkd_dict = require('../custom_module/sharkd_dict');
const CAPTURES_PATH = process.env.CAPTURES_PATH || "/captures/";


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
        files.forEach(function(pcap_file){
          if (pcap_file.endsWith('.pcap')) {
            let pcap_stats = fs.statSync(CAPTURES_PATH + pcap_file);
            if (loaded_files.includes(pcap_file)) {
              results.files.push({"name": pcap_file, "size": pcap_stats.size, "status": {"online": true}});
            } else {
              results.files.push({"name": pcap_file, "size": pcap_stats.size});
            }
          }
        });
        return reply.send(JSON.stringify(results));
      }
      
      if (request.query.req === 'download') {
        if ("capture" in request.query) {
          if (request.query.capture.includes('..')) {
            return JSON.stringify({"err": 1, "errstr": "Nope"});
          }

          let cap_file = request.query.capture;
          if (cap_file.startsWith("/")) {
            cap_file = cap_file.substr(1);
          }

          if ("token" in request.query) {
            
            if (request.query.token === "self") {
              reply.header('Content-disposition', 'attachment; filename=' + cap_file);
              return reply.sendFile(cap_file);
            } else {
              sharkd_dict.send_req(request.query).then((data) => {
                data = JSON.parse(data);
                reply.header('Content-Type', data.mime);
                reply.header('Content-disposition', 'attachment; filename="' + data.file + '"');
                let buff = new Buffer(data.data, 'base64');  
                return reply.send(buff);
              });
            }
            return JSON.stringify({"err": 1, "errstr": "Nope"});
          }
        }
      }
    }

    sharkd_dict.send_req(request.query).then((data) => {
      reply.send(data);
    });
  })

  next()
}
