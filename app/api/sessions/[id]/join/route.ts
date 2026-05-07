import { NextRequest, NextResponse } from 'next/server'
import { getSession, addParticipant } from '@/lib/db'
import { emitEvent } from '@/lib/events'
import { logger } from '@/lib/log'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { participant_name, participant_role } = await req.json()
  if (!participant_name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  const participantId = `${id}-${participant_name}`
  addParticipant(participantId, id, participant_name, participant_role || 'Guest')
  logger.info(`POST /api/sessions/${id}/join`, `${participant_name} joined`)

  emitEvent(id, { type: 'participant_joined', name: participant_name, role: participant_role })

  return NextResponse.json({ success: true })
}
