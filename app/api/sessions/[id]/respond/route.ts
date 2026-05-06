import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSteps, addParticipant, addResponse } from '@/lib/db'
import { emitEvent } from '@/lib/events'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/log'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) { logger.warn(`POST /api/sessions/${id}/respond`, 'Session not found'); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const { participant_name, participant_role, type, content } = await req.json()
  if (!participant_name || !content) { logger.warn(`POST /api/sessions/${id}/respond`, 'Missing fields', { participant_name, type }); return NextResponse.json({ error: 'Missing fields' }, { status: 400 }) }

  const steps = getSteps(id)
  const currentStep = steps[session.current_step]
  if (!currentStep) return NextResponse.json({ error: 'No active step' }, { status: 400 })

  const participantId = `${id}-${participant_name}`
  addParticipant(participantId, id, participant_name, participant_role || 'Officer')

  const responseId = uuidv4()
  addResponse(responseId, id, currentStep.id, participant_name, participant_role || 'Officer', type || 'text', content)
  logger.info(`POST /api/sessions/${id}/respond`, `Response from ${participant_name}`, { type, step: session.current_step })

  const response = { id: responseId, participant_name, participant_role, type, content, step_id: currentStep.id }
  emitEvent(id, { type: 'new_response', response })

  return NextResponse.json({ success: true, id: responseId })
}
