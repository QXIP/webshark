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
        files.forEach(function(pcap_file){
          if (pcap_file.endsWith('.pcap')) {
            let pcap_stats = fs.statSync(CAPTURES_PATH + pcap_file);
            results.files.push({"name": pcap_file, "size": pcap_stats.size});
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
          reply.header('Content-disposition', 'attachment; filename=' + cap_file);
          return reply.sendFile(cap_file);
        }
        return reply.send(JSON.stringify({"err": 1, "errstr": "Nope test"}));
      }
    }

    sharkd_dict.send_req(request.query).then((data) => {
      reply.send(data);
    });
  })

  next()
}
