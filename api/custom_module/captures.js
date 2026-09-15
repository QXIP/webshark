'use strict'

const fs = require('fs')
const path = require('path')

const CAPTURE_EXTENSIONS = ['.pcapng', '.pcap', '.cap']

function looksLikeCaptureContents (filePath) {
  let fd
  try {
    fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(4)
    const n = fs.readSync(fd, buf, 0, 4, 0)
    if (n < 4) return false
    const magic = buf.readUInt32LE(0)
    return magic === 0xa1b2c3d4 || magic === 0xd4c3b2a1 ||
      magic === 0xa1b23c4d || magic === 0x4d3cb2a1 ||
      magic === 0x0a0d0d0a
  } catch (_) {
    return false
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd) } catch (_) {}
    }
  }
}

function isCaptureFile (name, filePath) {
  const lower = String(name || '').toLowerCase()
  if (CAPTURE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return true
  }
  if (filePath) {
    return looksLikeCaptureContents(filePath)
  }
  return false
}

function safeCaptureBasename (name) {
  const base = path.basename(String(name || '')).replace(/\0/g, '')
  if (!base || base === '.' || base === '..') {
    throw new Error('invalid filename')
  }
  return base
}

function watchEvent (event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function captureChangeKind (prevSize, nextSize) {
  if (prevSize < 0) return 'init'
  if (nextSize < prevSize) return 'full'
  if (nextSize > prevSize) return 'append'
  return 'none'
}

function listCaptureFiles (capPath, loadedFiles) {
  const loaded = loadedFiles || []
  let names = []
  try {
    names = fs.readdirSync(capPath)
  } catch (err) {
    const e = new Error('cannot read captures')
    e.cause = err
    throw e
  }
  const results = { files: [], pwd: '.' }
  for (const name of names) {
    if (name.endsWith('.sock') || name.startsWith('.')) continue
    const full = path.join(capPath, name)
    if (!isCaptureFile(name, full)) continue
    if (name.includes('..') || name.includes('/') || name.includes('\\')) continue
    let stats
    try {
      stats = fs.statSync(path.join(capPath, name))
    } catch (_) {
      continue
    }
    if (!stats.isFile()) continue
    const entry = { name, size: stats.size }
    if (loaded.includes(name)) {
      entry.status = { online: true }
    }
    results.files.push(entry)
  }
  return results
}

module.exports = {
  CAPTURE_EXTENSIONS,
  looksLikeCaptureContents,
  isCaptureFile,
  safeCaptureBasename,
  watchEvent,
  captureChangeKind,
  listCaptureFiles
}
