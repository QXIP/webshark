'use strict'

const { test } = require('tap')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  isCaptureFile,
  safeCaptureBasename,
  watchEvent,
  captureChangeKind,
  listCaptureFiles
} = require('../../custom_module/captures')

test('accepts pcap, pcapng, and cap extensions', (t) => {
  t.ok(isCaptureFile('voip.pcapng'))
  t.ok(isCaptureFile('legacy.PCAP'))
  t.ok(isCaptureFile('old.cap'))
  t.notOk(isCaptureFile('notes.txt'))
  t.notOk(isCaptureFile('evil.pcap.exe'))
  t.end()
})

test('basename sanitizes nested upload names', (t) => {
  t.equal(safeCaptureBasename('subdir/nested.pcapng'), 'nested.pcapng')
  t.throws(() => safeCaptureBasename('..'))
  t.end()
})

test('watch SSE event format', (t) => {
  t.equal(
    watchEvent('capture-changed', { size: 12, mtime: 1 }),
    'event: capture-changed\ndata: {"size":12,"mtime":1}\n\n'
  )
  t.end()
})

test('capture change kind for grow/truncate', (t) => {
  t.equal(captureChangeKind(-1, 100), 'init')
  t.equal(captureChangeKind(100, 180), 'append')
  t.equal(captureChangeKind(180, 20), 'full')
  t.equal(captureChangeKind(100, 100), 'none')
  t.end()
})

test('lists pcapng, pcap, and cap; skips other files', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-list-'))
  fs.writeFileSync(path.join(dir, 'voip.pcapng'), Buffer.alloc(8))
  fs.writeFileSync(path.join(dir, 'legacy.pcap'), Buffer.alloc(4))
  fs.writeFileSync(path.join(dir, 'old.cap'), Buffer.alloc(2))
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x')
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }))
  const listed = listCaptureFiles(dir, ['voip.pcapng'])
  t.equal(listed.files.length, 3)
  const byName = Object.fromEntries(listed.files.map((f) => [f.name, f]))
  t.equal(byName['voip.pcapng'].size, 8)
  t.same(byName['voip.pcapng'].status, { online: true })
  t.equal(byName['legacy.pcap'].size, 4)
  t.notOk(byName['notes.txt'])
  t.end()
})

test('lists extensionless pcap files by magic', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webshark-list-'))
  const hdr = Buffer.from([0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00])
  fs.writeFileSync(path.join(dir, 'SIP_CALL_RTP_G711'), Buffer.concat([hdr, Buffer.alloc(20)]))
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'hello')
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }))
  const listed = listCaptureFiles(dir)
  t.equal(listed.files.length, 1)
  t.equal(listed.files[0].name, 'SIP_CALL_RTP_G711')
  t.end()
})
