import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSteps, getParticipants, getResponses } from '@/lib/db'
import { logger } from '@/lib/log'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) { logger.warn(`GET /api/sessions/${id}`, 'Session not found'); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const steps = getSteps(id)
  const participants = getParticipants(id)
  const responses = getResponses(id)

  return NextResponse.json({ session, steps, participants, responses })
}
