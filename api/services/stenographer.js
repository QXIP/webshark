'use strict'

/**
 * Stenographer remote query bridge (#42).
 *
 * Configure STENOGRAPHER_URL (e.g. https://steno.example.com:1234).
 * Optional: STENOGRAPHER_TIMEOUT_MS, STENOGRAPHER_PACKET_LIMIT,
 * STENOGRAPHER_RATE_MAX, STENOGRAPHER_RATE_TIME_WINDOW_MS.
 *
 * POST /webshark/stenographer
 *   body: { "query": "port 5060 and after 1m ago", "name": "optional.pcap" }
 * GET  /webshark/stenographer?query=...&name=...
 *
 * Saves the returned PCAP under CAPTURES_PATH and returns { name, size }.
 */

const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream/promises')
const { Readable } = require('stream')
const rateLimit = require('@fastify/rate-limit')

function capturesPath () {
  const p = process.env.CAPTURES_PATH || '/captures/'
  return p.endsWith(path.sep) ? p : p + path.sep
}

function stenoUrl () {
  return (process.env.STENOGRAPHER_URL || '').replace(/\/$/, '')
}

function safeName (name, fallback) {
  const base = path.basename(String(name || fallback || 'steno-query.pcap'))
  const cleaned = base.replace(/[^\w.\-]+/g, '_')
  return cleaned.endsWith('.pcap') ? cleaned : cleaned + '.pcap'
}

async function fetchStenoPcap (query) {
  const base = stenoUrl()
  if (!base) {
    const err = new Error('STENOGRAPHER_URL is not configured')
    err.statusCode = 501
    throw err
  }
  if (!query || !String(query).trim()) {
    const err = new Error('query is required')
    err.statusCode = 400
    throw err
  }

  const url = base + '/?query=' + encodeURIComponent(String(query).trim())
  const headers = {}
  const limit = process.env.STENOGRAPHER_PACKET_LIMIT || ''
  if (limit) {
    headers['Stenographer-Packet-Limit'] = String(limit)
  }

  const timeout = Number(process.env.STENOGRAPHER_TIMEOUT_MS) || 120000
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  let res
  try {
    res = await fetch(url, { headers, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const err = new Error('stenographer returned HTTP ' + res.status)
    err.statusCode = 502
    throw err
  }
  return res
}

module.exports = function (fastify, opts, next) {
  const max = Number(process.env.STENOGRAPHER_RATE_MAX) || 10
  const timeWindow = Number(process.env.STENOGRAPHER_RATE_TIME_WINDOW_MS) || 60 * 1000

  // Rate-limit expensive Stenographer fetches that write into CAPTURES_PATH.
  fastify.register(async function stenoQueryScope (scope) {
    await scope.register(rateLimit, {
      max,
      timeWindow,
      hook: 'preHandler',
      errorResponseBuilder: function (_req, context) {
        return {
          err: 1,
          errstr: 'rate limit exceeded, retry after ' + context.after,
          statusCode: 429
        }
      }
    })

    async function handleQuery (req, reply) {
      const body = req.body || {}
      const query = (req.query && req.query.query) || body.query
      const name = safeName(
        (req.query && req.query.name) || body.name,
        'steno-' + Date.now() + '.pcap'
      )
      const dest = path.join(capturesPath(), name)

      try {
        const res = await fetchStenoPcap(query)
        const out = fs.createWriteStream(dest)
        const bodyStream = res.body && typeof res.body.getReader === 'function'
          ? Readable.fromWeb(res.body)
          : res.body
        await pipeline(bodyStream, out)
      } catch (err) {
        try { fs.unlinkSync(dest) } catch (_) {}
        reply.code(err.statusCode || 500)
        return { err: 1, errstr: err.message || 'stenographer query failed' }
      }

      let size = 0
      try { size = fs.statSync(dest).size } catch (_) {}
      return { name, size, query: String(query).trim() }
    }

    scope.get('/webshark/stenographer', handleQuery)
    scope.post('/webshark/stenographer', handleQuery)
  })

  fastify.get('/webshark/stenographer/status', async () => {
    const url = stenoUrl()
    return { enabled: Boolean(url), url: url || null }
  })

  next()
}
