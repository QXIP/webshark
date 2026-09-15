'use strict'

function isTrustworthyOrigin (req) {
  const raw = String((req && req.hostname) || '').toLowerCase()
  if (
    raw === 'localhost' || raw.startsWith('localhost:') ||
    raw === '127.0.0.1' || raw.startsWith('127.0.0.1:') ||
    raw === '::1' || raw.startsWith('[::1]')
  ) {
    return true
  }
  const forwarded = String((req.headers && req.headers['x-forwarded-proto']) || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  const proto = forwarded || String(req.protocol || '').toLowerCase()
  return proto === 'https'
}

function applyIsolationHeaders (fastify) {
  fastify.addHook('onRequest', async (req, reply) => {
    if (!isTrustworthyOrigin(req)) {
      return
    }
    reply.header('Cross-Origin-Opener-Policy', 'same-origin')
    reply.header('Cross-Origin-Embedder-Policy', 'credentialless')
    reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
  })
}

module.exports = { applyIsolationHeaders, isTrustworthyOrigin }
