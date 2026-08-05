'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const fs = require('fs')
const os = require('os')
const path = require('path')

function multipartBody (filename, payload, boundary) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n'
    ),
    payload,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ])
}

test('streaming upload writes pcap to captures path', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-up-'))
  process.env.CAPTURES_PATH = dir.endsWith(path.sep) ? dir : dir + path.sep

  const app = Fastify()
  app.register(require('../../services/upload'))
  t.teardown(async () => {
    await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  await app.ready()

  const payload = Buffer.alloc(1024, 0xab)
  const boundary = '----websharktestboundary'
  const res = await app.inject({
    method: 'POST',
    url: '/webshark/upload',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`
    },
    payload: multipartBody('sample.pcap', payload, boundary)
  })

  t.equal(res.statusCode, 200, res.body)
  const json = JSON.parse(res.body)
  t.equal(json.name, 'sample.pcap')
  t.equal(json.size, payload.length)
  t.ok(fs.existsSync(path.join(dir, 'sample.pcap')))
  t.equal(fs.statSync(path.join(dir, 'sample.pcap')).size, payload.length)
})

test('upload sanitizes nested filenames with basename', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-up-'))
  process.env.CAPTURES_PATH = dir.endsWith(path.sep) ? dir : dir + path.sep

  delete require.cache[require.resolve('../../services/upload')]
  const app = Fastify()
  app.register(require('../../services/upload'))
  t.teardown(async () => {
    await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  await app.ready()

  const boundary = '----websharktestboundary'
  const res = await app.inject({
    method: 'POST',
    url: '/webshark/upload',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`
    },
    payload: multipartBody('subdir/nested.pcap', Buffer.from('abcd'), boundary)
  })

  t.equal(res.statusCode, 200, res.body)
  const json = JSON.parse(res.body)
  t.equal(json.name, 'nested.pcap')
  t.ok(fs.existsSync(path.join(dir, 'nested.pcap')))
  t.notOk(fs.existsSync(path.join(dir, 'subdir')))
})
test('stenographer status reports disabled without STENOGRAPHER_URL', async (t) => {
  delete process.env.STENOGRAPHER_URL
  const app = Fastify()
  app.register(require('../../services/stenographer'))
  t.teardown(() => app.close())
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark/stenographer/status' })
  t.equal(res.statusCode, 200)
  t.same(JSON.parse(res.body), { enabled: false, url: null })
})

test('files listing returns pcap sizes as numbers', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-files-'))
  process.env.CAPTURES_PATH = dir.endsWith(path.sep) ? dir : dir + path.sep
  fs.writeFileSync(path.join(dir, 'a.pcap'), Buffer.alloc(10))
  fs.writeFileSync(path.join(dir, 'ignore.txt'), 'x')

  const Module = require('module')
  const original = Module.prototype.require
  Module.prototype.require = function (id) {
    if (String(id).includes('sharkd_dict')) {
      return { get_loaded_sockets: () => [], send_req: async () => '{}' }
    }
    return original.apply(this, arguments)
  }
  t.teardown(() => {
    Module.prototype.require = original
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const rootPath = require.resolve('../../services/root')
  delete require.cache[rootPath]
  const app = Fastify()
  app.register(require('../../services/root'))
  t.teardown(() => app.close())
  await app.ready()

  const res = await app.inject({ method: 'GET', url: '/webshark/json?method=files' })
  t.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  t.equal(body.files.length, 1)
  t.equal(body.files[0].name, 'a.pcap')
  t.equal(body.files[0].size, 10)
})
