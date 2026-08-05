'use strict'
const fs = require('fs')
const path = require('path')
const sharkd_dict = require('../custom_module/sharkd_dict')
function capturesPath () {
  const p = process.env.CAPTURES_PATH || '/captures/'
  return p.endsWith(path.sep) ? p : p + path.sep
}

module.exports = function (fastify, opts, next) {
  fastify.register(require('@fastify/static'), {
    root: capturesPath(),
    prefix: '/webshark//', // defeat unique prefix
  })

  fastify.get('/', async (req, res) => {
    res.redirect('/webshark')
  })

  fastify.get('/webshark/json', function (request, reply) {
    if (!(request.query && 'method' in request.query)) {
      return
    }

    if (request.query.method === 'files') {
      const capPath = capturesPath()
      let files = []
      try {
        files = fs.readdirSync(capPath)
      } catch (err) {
        reply.code(500).send(JSON.stringify({ err: 1, errstr: 'cannot read captures' }))
        return
      }

      const results = { files: [], pwd: '.' }
      let loaded_files = []
      try {
        loaded_files = sharkd_dict.get_loaded_sockets() || []
      } catch (_) {}

      for (const pcap_file of files) {
        if (!pcap_file.endsWith('.pcap')) {
          continue
        }
        // Skip path traversal / odd names
        if (pcap_file.includes('..') || pcap_file.includes('/') || pcap_file.includes('\\')) {
          continue
        }
        let pcap_stats
        try {
          pcap_stats = fs.statSync(path.join(capPath, pcap_file))
        } catch (_) {
          continue
        }
        if (!pcap_stats.isFile()) {
          continue
        }
        const entry = { name: pcap_file, size: pcap_stats.size }
        if (loaded_files.includes(pcap_file)) {
          entry.status = { online: true }
        }
        results.files.push(entry)
      }
      reply.send(JSON.stringify(results))
      return
    }

    if (request.query.method === 'download') {
      if (!('capture' in request.query)) {
        reply.send(JSON.stringify({ err: 1, errstr: 'Nope' }))
        return
      }
      if (request.query.capture.includes('..')) {
        reply.send(JSON.stringify({ err: 1, errstr: 'Nope' }))
        return
      }

      let cap_file = request.query.capture
      if (cap_file.startsWith('/')) {
        cap_file = cap_file.substr(1)
      }

      if (!('token' in request.query)) {
        reply.send(JSON.stringify({ err: 1, errstr: 'Nope' }))
        return
      }

      if (request.query.token === 'self') {
        reply.header('Content-disposition', 'attachment; filename=' + cap_file)
        reply.sendFile(cap_file)
        return
      }

      sharkd_dict.send_req(request.query).then((data) => {
        try {
          data = JSON.parse(data)
          reply.header('Content-Type', data.mime)
          reply.header('Content-disposition', 'attachment; filename="' + data.file + '"')
          const buff = Buffer.from(data.data, 'base64')
          reply.send(buff)
        } catch (err) {
          reply.send(JSON.stringify({ err: 1, errstr: 'Nope' }))
        }
      })
      return
    }

    if (
      request.query.method === 'tap' &&
      'tap0' in request.query &&
      ['srt:dcerpc', 'srt:rpc', 'srt:scsi', 'rtd:megaco'].includes(request.query.tap0)
    ) {
      reply.send(null)
      return
    }

    sharkd_dict.send_req(request.query).then((data) => {
      reply.send(data)
    })
  })

  next()
}
