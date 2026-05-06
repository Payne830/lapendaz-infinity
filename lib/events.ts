type EventListener = (data: object) => void

const listeners = new Map<string, Set<EventListener>>()

export function subscribe(sessionId: string, listener: EventListener): () => void {
  if (!listeners.has(sessionId)) listeners.set(sessionId, new Set())
  listeners.get(sessionId)!.add(listener)
  return () => listeners.get(sessionId)?.delete(listener)
}

export function emitEvent(sessionId: string, data: object) {
  listeners.get(sessionId)?.forEach(fn => fn(data))
}
