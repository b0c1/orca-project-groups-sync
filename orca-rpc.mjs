// Minimal client for the local Orca runtime RPC — the same pipe/socket and
// auth token the bundled `orca` CLI uses. One request per connection,
// newline-delimited JSON, keepalive frames skipped.
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REQUEST_TIMEOUT_MS = 30_000

// Plugin workers get a scrubbed env (no APPDATA / XDG_CONFIG_HOME), so mirror Electron's defaults.
export function userDataPath(env = process.env, platform = process.platform) {
  if (env.ORCA_USER_DATA_PATH) {
    return env.ORCA_USER_DATA_PATH
  }
  const home = env.USERPROFILE || env.HOME || homedir()
  if (platform === 'win32') {
    return join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'orca')
  }
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'orca')
  }
  return join(env.XDG_CONFIG_HOME || join(home, '.config'), 'orca')
}

async function readRuntimeMetadata() {
  const path = join(userDataPath(), 'orca-runtime.json')
  let metadata
  try {
    metadata = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw new Error(`Orca runtime metadata not readable at ${path}; is Orca running?`)
  }
  const transports = Array.isArray(metadata?.transports)
    ? metadata.transports
    : [metadata?.transport].filter(Boolean)
  const transport = transports.find((t) => t?.kind === 'unix' || t?.kind === 'named-pipe')
  if (!transport?.endpoint || !metadata?.authToken) {
    throw new Error(`Orca runtime metadata at ${path} has no local transport or auth token`)
  }
  return { endpoint: transport.endpoint, authToken: metadata.authToken, runtimeId: metadata.runtimeId }
}

export async function call(method, params) {
  const metadata = await readRuntimeMetadata()
  const id = randomUUID()
  return new Promise((resolve, reject) => {
    const socket = createConnection(metadata.endpoint)
    let buffer = ''
    let settled = false
    const finish = (error, value) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      socket.destroy()
      error ? reject(error) : resolve(value)
    }
    const timer = setTimeout(
      () => finish(new Error(`Orca RPC ${method} timed out`)),
      REQUEST_TIMEOUT_MS
    )
    socket.setEncoding('utf8')
    socket.on('error', (error) => finish(new Error(`Orca RPC connection failed: ${error.message}`)))
    socket.on('close', () => finish(new Error(`Orca closed the connection during ${method}`)))
    socket.on('connect', () => {
      socket.write(`${JSON.stringify({ id, authToken: metadata.authToken, method, params })}\n`)
    })
    socket.on('data', (chunk) => {
      buffer += chunk
      let newline
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (!line) {
          continue
        }
        let frame
        try {
          frame = JSON.parse(line)
        } catch {
          return finish(new Error(`Orca RPC ${method} returned a malformed frame`))
        }
        if (frame._keepalive) {
          timer.refresh()
          continue
        }
        if (frame.id !== id) {
          return finish(new Error(`Orca RPC ${method} returned a mismatched response id`))
        }
        if (frame.ok) {
          return finish(null, frame.result)
        }
        return finish(
          new Error(`Orca RPC ${method} failed: ${frame.error?.message ?? frame.error?.code}`)
        )
      }
    })
  })
}
