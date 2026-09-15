'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const fs = require('fs')
const os = require('os')
const path = require('path')

function loadWebApp (t, webDir) {
  process.env.WEB_ROOT = webDir
  const webPath = require.resolve('../../services/web')
  delete require.cache[webPath]
  const app = Fastify()
  app.register(require('../../services/web'))
  t.teardown(async () => {
    await app.close()
    fs.rmSync(webDir, { recursive: true, force: true })
  })
  return app
}

test('GET /webshark/ serves the UI from the same origin as the API', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-ui-'))
  fs.writeFileSync(path.join(dir, 'index.html'), '<html><base href="/webshark/"><body>webshark-ui</body></html>')
  const app = loadWebApp(t, dir)
  await app.ready()

  const res = await app.inject({
    method: 'GET',
    url: '/webshark/',
    headers: { host: 'localhost:8085' }
  })
  t.equal(res.statusCode, 200)
  t.match(res.body, /webshark-ui/)
  t.match(res.headers['content-type'], /text\/html/)
  t.equal(res.headers['cross-origin-opener-policy'], 'same-origin')
  t.equal(res.headers['cross-origin-embedder-policy'], 'credentialless')
})

test('LAN HTTP hosts do not get COOP/COEP headers', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-ui-'))
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>ok</html>')
  const app = loadWebApp(t, dir)
  await app.ready()
  const res = await app.inject({
    method: 'GET',
    url: '/webshark/',
    headers: { host: 'spark-ams01:8085' }
  })
  t.equal(res.statusCode, 200)
  t.notOk(res.headers['cross-origin-opener-policy'])
})

test('hashed bundles are served from disk after rebuild', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-ui-'))
  fs.writeFileSync(path.join(dir, 'index.html'), '<script src="main.abc123.js"></script>')
  fs.writeFileSync(path.join(dir, 'main.abc123.js'), 'window.__webshark=1')
  const app = loadWebApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark/main.abc123.js' })
  t.equal(res.statusCode, 200)
  t.match(res.body, /__webshark/)
})

test('GET /webshark redirects to /webshark/', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-ui-'))
  fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>')
  const app = loadWebApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark', followRedirects: false })
  t.equal(res.statusCode, 302)
  t.equal(res.headers.location, '/webshark/')
})

test('embed routes serve the SPA index', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-ui-'))
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>embed-ok</html>')
  const app = loadWebApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark/embed/rtp' })
  t.equal(res.statusCode, 200)
  t.match(res.body, /embed-ok/)
})

test('missing UI build returns 503', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-ui-'))
  const app = loadWebApp(t, dir)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/webshark/embed' })
  t.equal(res.statusCode, 503)
})
