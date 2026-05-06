const LEVELS = { info: '🔵', warn: '🟡', error: '🔴' } as const
type Level = keyof typeof LEVELS

function log(level: Level, route: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
  const icon = LEVELS[level]
  const extra = data ? ' ' + JSON.stringify(data) : ''
  console.log(`${icon} [${ts}] [${route}] ${msg}${extra}`)
}

export const logger = {
  info:  (route: string, msg: string, data?: unknown) => log('info',  route, msg, data),
  warn:  (route: string, msg: string, data?: unknown) => log('warn',  route, msg, data),
  error: (route: string, msg: string, data?: unknown) => log('error', route, msg, data),
}
