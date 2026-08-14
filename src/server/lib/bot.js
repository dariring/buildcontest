// 디스코드 봇 싱글턴.
//
// - DiscordSRV 콘솔 채널에 평문 메시지를 보내면 서버 콘솔 명령으로 실행됩니다.
// - 투표 제출 알림도 같은 클라이언트로 보냅니다.
// - 토큰이 바뀌면 자동으로 재로그인합니다.
import { getConfig } from './config.js'

const state = (globalThis.__bcBot ??= {
  client: null,
  token: null,
  ready: false,
  error: null,
  loggingIn: null,
})

export function botStatus() {
  return {
    configured: Boolean(getConfig().discord.botToken),
    ready: state.ready,
    error: state.error,
    tag: state.client?.user?.tag ?? null,
  }
}

async function createClient(token) {
  const { Client, Events, GatewayIntentBits } = await import('discord.js')
  const client = new Client({ intents: [GatewayIntentBits.Guilds] })

  client.on(Events.Error, (err) => {
    state.error = err.message
  })

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('봇 준비 시간 초과 (20초)')), 20000)
    client.once(Events.ClientReady, () => {
      clearTimeout(timer)
      resolve()
    })
  })

  await client.login(token)
  await ready
  return client
}

export async function ensureBot() {
  const token = getConfig().discord.botToken?.trim()

  if (!token) {
    if (state.client) await destroyBot()
    state.error = null
    return null
  }

  if (state.client && state.ready && state.token === token) return state.client
  if (state.loggingIn && state.token === token) return state.loggingIn

  if (state.client) await destroyBot()

  state.token = token
  state.loggingIn = createClient(token)
    .then((client) => {
      state.client = client
      state.ready = true
      state.error = null
      console.log(`[bot] 로그인 완료: ${client.user.tag}`)
      return client
    })
    .catch((err) => {
      state.client = null
      state.ready = false
      state.error = err.message
      console.error('[bot] 로그인 실패:', err.message)
      throw err
    })
    .finally(() => {
      state.loggingIn = null
    })

  return state.loggingIn
}

export async function destroyBot() {
  const client = state.client
  state.client = null
  state.ready = false
  if (client) {
    try {
      await client.destroy()
    } catch {
      /* 이미 끊긴 경우 무시 */
    }
  }
}

export async function restartBot() {
  await destroyBot()
  state.token = null
  return ensureBot()
}

async function fetchChannel(channelId) {
  if (!channelId) throw new Error('채널 ID가 설정되지 않았습니다.')
  const client = await ensureBot()
  if (!client) throw new Error('봇 토큰이 설정되지 않았습니다.')
  const channel = await client.channels.fetch(String(channelId)).catch(() => null)
  if (!channel) throw new Error(`채널을 찾을 수 없습니다 (${channelId}). 봇이 해당 서버에 있는지 확인해주세요.`)
  if (typeof channel.send !== 'function') throw new Error('이 채널에는 메시지를 보낼 수 없습니다.')
  return channel
}

/** DiscordSRV 콘솔 채널로 명령어 한 줄 전송. */
export async function sendConsoleCommand(command) {
  const { consoleChannelId } = getConfig().discord
  const channel = await fetchChannel(consoleChannelId)
  await channel.send(command)
  return true
}

export async function sendToChannel(channelId, payload) {
  const channel = await fetchChannel(channelId)
  await channel.send(payload)
  return true
}
