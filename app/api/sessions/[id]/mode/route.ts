import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSessionMode } from '@/lib/db'
import { emitEvent } from '@/lib/events'
import { logger } from '@/lib/log'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) { logger.warn(`POST /api/sessions/${id}/mode`, 'Session not found'); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const { mode } = await req.json()
  if (mode !== 'slide' && mode !== 'question') { logger.warn(`POST /api/sessions/${id}/mode`, `Invalid mode: ${mode}`); return NextResponse.json({ error: 'Invalid mode' }, { status: 400 }) }

  updateSessionMode(id, mode)
  emitEvent(id, { type: 'mode_changed', mode })
  logger.info(`POST /api/sessions/${id}/mode`, `Mode set to ${mode}`)

  return NextResponse.json({ mode })
}
