'use strict'
const fs = require('fs')
const path = require('path')
const rateLimit = require('@fastify/rate-limit')
const {
  isCaptureFile,
  listCaptureFiles,
  watchEvent,
  captureChangeKind,
  safeCaptureBasename
} = require('../custom_module/captures')

function capturesPath () {
  const p = process.env.CAPTURES_PATH || '/captures/'
  return p.endsWith(path.sep) ? p : p + path.sep
}

function filesResponse (reply) {
  try {
    reply.send(JSON.stringify(listCaptureFiles(capturesPath(), [])))
  } catch (err) {
    reply.code(500).send(JSON.stringify({ err: 1, errstr: 'cannot read captures' }))
  }
}

function resolveCapture (name) {
  let base
  try {
    base = safeCaptureBasename(name)
  } catch (_) {
    return null
  }
  if (String(name || '').includes('..')) {
    return null
  }
  const full = path.join(capturesPath(), base)
  if (!fs.existsSync(full) || !isCaptureFile(base, full)) {
    return null
  }
  return { base, full }
}

function sendCaptureFile (reply, resolved, asAttachment) {
  if (asAttachment) {
    reply.header('Content-Disposition', 'attachment; filename="' + resolved.base + '"')
  }
  reply.header('Content-Type', 'application/octet-stream')
  return reply.send(fs.createReadStream(resolved.full))
}

module.exports = async function (fastify) {
  const max = Number(process.env.API_RATE_MAX) || 120
  const timeWindow = Number(process.env.API_RATE_TIME_WINDOW_MS) || 60 * 1000
  const rateLimitConfig = { max, timeWindow }

  await fastify.register(rateLimit, {
    global: false,
    max,
    timeWindow
  })

  fastify.get('/', async (req, res) => {
    res.redirect('/webshark')
  })

  fastify.get('/webshark/captures/:name', { config: { rateLimit: rateLimitConfig } }, async function (request, reply) {
    const resolved = resolveCapture(request.params.name)
    if (!resolved) {
      reply.code(404).send({ err: 1, errstr: 'not found' })
      return
    }
    return sendCaptureFile(reply, resolved, false)
  })

  fastify.get('/webshark/json', { config: { rateLimit: rateLimitConfig } }, function (request, reply) {
    if (!(request.query && 'method' in request.query)) {
      return
    }

    const method = request.query.method
    if (method === 'files') {
      filesResponse(reply)
      return
    }

    if (method === 'download') {
      if (!('capture' in request.query) || String(request.query.capture).includes('..')) {
        reply.send(JSON.stringify({ err: 1, errstr: 'Nope' }))
        return
      }
      if (request.query.token !== 'self') {
        reply.code(400).send(JSON.stringify({ err: 1, errstr: 'download tokens are handled in the browser' }))
        return
      }
      const resolved = resolveCapture(request.query.capture)
      if (!resolved) {
        reply.code(404).send(JSON.stringify({ err: 1, errstr: 'not found' }))
        return
      }
      return sendCaptureFile(reply, resolved, true)
    }

    reply.code(400).send(JSON.stringify({ err: 1, errstr: `method not allowed: ${method}` }))
  })

  fastify.get('/webshark/watch', { config: { rateLimit: rateLimitConfig } }, async function (request, reply) {
    const capture = request.query && request.query.capture
    if (!capture || String(capture).includes('..')) {
      reply.code(400).send({ err: 1, errstr: 'invalid capture' })
      return
    }
    const resolved = resolveCapture(capture)
    if (!resolved) {
      const base = path.basename(String(capture))
      const full = path.join(capturesPath(), base)
      if (!fs.existsSync(full)) {
        reply.code(404).send({ err: 1, errstr: 'not found' })
        return
      }
      reply.code(400).send({ err: 1, errstr: 'invalid capture' })
      return
    }

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    })

    let prevSize = -1
    const send = (event, data) => {
      try {
        reply.raw.write(watchEvent(event, data))
      } catch (_) {}
    }

    const tick = async () => {
      let st
      try {
        st = fs.statSync(resolved.full)
      } catch (_) {
        return
      }
      const kind = captureChangeKind(prevSize, st.size)
      if (kind === 'none') {
        return
      }
      prevSize = st.size
      send('capture-changed', { size: st.size, mtime: st.mtimeMs, kind })
    }

    await tick()
    fs.watchFile(resolved.full, { interval: 400 }, () => { tick() })
    const heartbeat = setInterval(() => send('heartbeat', { t: Date.now() }), 15000)

    const stop = () => {
      fs.unwatchFile(resolved.full)
      clearInterval(heartbeat)
    }
    request.raw.on('close', stop)
    request.raw.on('end', stop)
  })
}
