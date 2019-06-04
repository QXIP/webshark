'use strict'
const sharkd_dict = require('../custom_module/sharkd_dict');

module.exports = function (fastify, opts, next) {
  fastify.get('/webshark/json', function (request, reply) {

    sharkd_dict.send_req(request.query).then((data) => {
      reply.send(data);
    });
  })

  next()
}
