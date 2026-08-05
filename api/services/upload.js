'use strict'

const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream/promises')
const multipart = require('@fastify/multipart')
const rateLimit = require('@fastify/rate-limit')

const MAX_FILE_SIZE = Number(process.env.UPLOAD_MAX_BYTES) || Infinity

function capturesPath () {
  const p = process.env.CAPTURES_PATH || '/captures/'
  return p.endsWith(path.sep) ? p : p + path.sep
}

function safeCaptureName (name) {
  const base = path.basename(String(name || '')).replace(/[\0]/g, '')
  if (!base || base === '.' || base === '..') {
    throw new Error('invalid filename')
  }
  return base
}

async function writeUploadStream (destPath, inputStream) {
  const out = fs.createWriteStream(destPath)
  try {
    await pipeline(inputStream, out)
  } catch (err) {
    try { fs.unlinkSync(destPath) } catch (_) {}
    throw err
  }
}

module.exports = async function (fastify) {
  const max = Number(process.env.UPLOAD_RATE_MAX) || 30
  const timeWindow = Number(process.env.UPLOAD_RATE_TIME_WINDOW_MS) || 60 * 1000
  const rateLimitConfig = { max, timeWindow }

  await fastify.register(rateLimit, {
    global: false,
    max,
    timeWindow
  })

  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 20
    }
  })

  fastify.post('/webshark/upload', { config: { rateLimit: rateLimitConfig } }, async function (req, reply) {
    const fileArr = []

    // Prefer streaming multipart parts (avoids Buffer/fs.write INT32 limit on huge PCAPs).
    if (typeof req.parts === 'function') {
      const parts = req.parts()
      for await (const part of parts) {
        if (part.type !== 'file') {
          continue
        }
        let filename
        try {
          filename = safeCaptureName(part.filename)
        } catch (err) {
          reply.code(400)
          return { err: 1, errstr: err.message }
        }

        const destPath = path.join(capturesPath(), filename)
        try {
          await writeUploadStream(destPath, part.file)
        } catch (err) {
          req.log.error({ err, filename }, 'upload failed')
          reply.code(500)
          return { err: 1, errstr: 'upload failed' }
        }

        let size = 0
        try {
          size = fs.statSync(destPath).size
        } catch (_) {}

        fileArr.push({
          name: filename,
          mimetype: part.mimetype,
          size
        })
      }
    } else if (req.raw && req.raw.files) {
      // Legacy fastify-file-upload shape: write in chunks to avoid INT32 write limit.
      const files = req.raw.files
      for (const key of Object.keys(files)) {
        const f = files[key]
        if (!f || !f.name || !f.data) {
          continue
        }
        let filename
        try {
          filename = safeCaptureName(f.name)
        } catch (err) {
          reply.code(400)
          return { err: 1, errstr: err.message }
        }
        const destPath = path.join(capturesPath(), filename)
        const data = f.data
        const CHUNK = 64 * 1024 * 1024
        const fd = fs.openSync(destPath, 'w')
        try {
          for (let offset = 0; offset < data.length; offset += CHUNK) {
            const end = Math.min(offset + CHUNK, data.length)
            fs.writeSync(fd, data, offset, end - offset)
          }
        } finally {
          fs.closeSync(fd)
        }
        fileArr.push({
          name: filename,
          mimetype: f.mimetype,
          size: f.size != null ? f.size : data.length
        })
      }
    }

    if (!fileArr.length) {
      reply.code(400)
      return { err: 1, errstr: 'no files uploaded' }
    }
    return fileArr.length === 1 ? fileArr[0] : fileArr
  })
}
