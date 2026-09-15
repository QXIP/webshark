'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const fs = require('fs')
const os = require('os')
const path = require('path')

function loadRootApp (t, dir) {
  process.env.CAPTURES_PATH = dir.endsWith(path.sep) ? dir : dir + path.sep
  const rootPath = require.resolve('../../services/root')
  delete require.cache[rootPath]
  const app = Fastify()
  app.register(require('../../services/root'))
  t.teardown(async () => {
    await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  return app
}

test('GET /webshark/json files lists pcapng and pcap', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-root-'))
  fs.writeFileSync(path.join(dir, 'call.pcapng'), Buffer.alloc(12))
  fs.writeFileSync(path.join(dir, 'a.pcap'), Buffer.alloc(10))
  fs.writeFileSync(path.join(dir, 'ignore.txt'), 'x')
  const app = loadRootApp(t, dir)
  await app.ready()

  const res = await app.inject({ method: 'GET', url: '/webshark/json?method=files' })
  t.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  const names = body.files.map((f) => f.name).sort()
  t.same(names, ['a.pcap', 'call.pcapng'])
  t.equal(body.files.find((f) => f.name === 'call.pcapng').size, 12)
})

test('GET /webshark/captures serves the raw capture', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-cap-'))
  const bytes = Buffer.from('pcap-bytes')
  fs.writeFileSync(path.join(dir, 'voip.pcapng'), bytes)
  const app = loadRootApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark/captures/voip.pcapng' })
  t.equal(res.statusCode, 200)
  t.equal(res.body, 'pcap-bytes')
})

test('GET /webshark/captures rejects traversal', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-cap-'))
  const app = loadRootApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark/captures/..%2Fetc%2Fpasswd' })
  t.equal(res.statusCode, 404)
})

test('GET /webshark/json rejects disallowed methods', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-deny-'))
  const app = loadRootApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark/json?method=eval' })
  t.equal(res.statusCode, 400)
  const frames = await app.inject({ method: 'GET', url: '/webshark/json?method=frames' })
  t.equal(frames.statusCode, 400)
})

test('GET /webshark/watch rejects missing and non-capture files', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-watch-'))
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x')
  const app = loadRootApp(t, dir)
  await app.ready()

  const missing = await app.inject({ method: 'GET', url: '/webshark/watch?capture=nope.pcapng' })
  t.equal(missing.statusCode, 404)

  const bad = await app.inject({ method: 'GET', url: '/webshark/watch?capture=notes.txt' })
  t.equal(bad.statusCode, 400)

  const trav = await app.inject({ method: 'GET', url: '/webshark/watch?capture=../etc/passwd' })
  t.equal(trav.statusCode, 400)
})

test('GET / redirects to /webshark', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-redir-'))
  const app = loadRootApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/', followRedirects: false })
  t.equal(res.statusCode, 302)
  t.equal(res.headers.location, '/webshark')
})
