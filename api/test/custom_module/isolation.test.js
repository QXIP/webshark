'use strict'

const { test } = require('tap')
const { isTrustworthyOrigin } = require('../../custom_module/isolation')

test('localhost and loopback are trustworthy', (t) => {
  t.ok(isTrustworthyOrigin({ hostname: 'localhost', protocol: 'http', headers: {} }))
  t.ok(isTrustworthyOrigin({ hostname: '127.0.0.1:8085', protocol: 'http', headers: {} }))
  t.ok(isTrustworthyOrigin({ hostname: '::1', protocol: 'http', headers: {} }))
  t.end()
})

test('LAN HTTP hostnames are not trustworthy', (t) => {
  t.notOk(isTrustworthyOrigin({ hostname: 'spark-ams01', protocol: 'http', headers: {} }))
  t.notOk(isTrustworthyOrigin({ hostname: 'spark-ams01:8085', protocol: 'http', headers: {} }))
  t.end()
})

test('https and forwarded https are trustworthy', (t) => {
  t.ok(isTrustworthyOrigin({ hostname: 'example.com', protocol: 'https', headers: {} }))
  t.ok(isTrustworthyOrigin({
    hostname: 'spark-ams01',
    protocol: 'http',
    headers: { 'x-forwarded-proto': 'https' }
  }))
  t.end()
})
