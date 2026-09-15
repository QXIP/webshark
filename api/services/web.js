'use strict'

const fs = require('fs')
const path = require('path')
const { applyIsolationHeaders } = require('../custom_module/isolation')

function webRoot () {
  return process.env.WEB_ROOT || path.join(__dirname, '../../web')
}

function sendIndex (reply, root) {
  const index = path.join(root, 'index.html')
  if (!fs.existsSync(index)) {
    reply.code(503).send({ err: 1, errstr: 'UI not built' })
    return
  }
  reply.type('text/html; charset=utf-8')
  reply.send(fs.readFileSync(index, 'utf8'))
}

module.exports = async function (fastify) {
  const root = webRoot()
  applyIsolationHeaders(fastify)

  fastify.get('/webshark', async (req, reply) => {
    return reply.redirect('/webshark/')
  })

  fastify.get('/webshark/embed', async (req, reply) => {
    return sendIndex(reply, root)
  })

  fastify.get('/webshark/embed/:view', async (req, reply) => {
    return sendIndex(reply, root)
  })

  await fastify.register(require('@fastify/static'), {
    root,
    prefix: '/webshark/',
    index: ['index.html'],
    wildcard: true,
    decorateReply: false
  })
}

module.exports.webRoot = webRoot
