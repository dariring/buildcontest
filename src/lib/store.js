// Tiny JSON-file store. Everything this app persists is small (a few dozen
// participants, a few hundred votes), so a flat file per collection keeps
// `npm install` free of native build steps.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import path from 'node:path'

export const DATA_DIR = process.env.BUILDCONTEST_DATA_DIR
  ? path.resolve(process.env.BUILDCONTEST_DATA_DIR)
  : path.resolve(process.cwd(), 'data')

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

// Next.js can evaluate a module more than once (dev HMR, route isolation).
// Hanging the cache off globalThis keeps a single source of truth per process.
const cache = (globalThis.__bcStoreCache ??= new Map())

function file(name) {
  return path.join(DATA_DIR, `${name}.json`)
}

export function read(name, fallback) {
  if (cache.has(name)) return cache.get(name)
  ensureDir()
  const target = file(name)
  let value = fallback
  if (existsSync(target)) {
    try {
      const raw = readFileSync(target, 'utf-8').trim()
      if (raw) value = JSON.parse(raw)
    } catch (err) {
      console.error(`[store] ${name}.json is unreadable, falling back to defaults:`, err.message)
    }
  }
  cache.set(name, value)
  return value
}

export function write(name, value) {
  ensureDir()
  const target = file(name)
  const tmp = `${target}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8')
  renameSync(tmp, target)
  cache.set(name, value)
  return value
}

/** Read, mutate through `fn`, then persist whatever `fn` returns. */
export function update(name, fallback, fn) {
  const next = fn(read(name, fallback))
  return write(name, next)
}

export function invalidate(name) {
  if (name) cache.delete(name)
  else cache.clear()
}
