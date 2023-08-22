'use strict'

const path = require('path')

module.exports = function (fastify, opts, next) {
  fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, '../../web'),
    prefix: '/webshark',
    redirect: true
  })

  next()
}
