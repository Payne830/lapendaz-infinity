import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSteps, advanceStep, updateSessionStatus } from '@/lib/db'
import { emitEvent } from '@/lib/events'
import { logger } from '@/lib/log'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) { logger.warn(`POST /api/sessions/${id}/advance`, 'Session not found'); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const steps = getSteps(id)
  const { direction } = await req.json()
  logger.info(`POST /api/sessions/${id}/advance`, `direction=${direction}`, { currentStep: session.current_step, totalSteps: steps.length })

  if (direction === 'start') {
    updateSessionStatus(id, 'live')
    emitEvent(id, { type: 'step_changed', step: 0, stepData: steps[0] })
    logger.info(`POST /api/sessions/${id}/advance`, 'Session started')
    return NextResponse.json({ current_step: 0, stepData: steps[0] })
  }

  let nextStep = session.current_step
  if (direction === 'next') nextStep = Math.min(session.current_step + 1, steps.length - 1)
  if (direction === 'prev') nextStep = Math.max(session.current_step - 1, 0)
  if (direction === 'end') {
    updateSessionStatus(id, 'ended')
    emitEvent(id, { type: 'session_ended' })
    logger.info(`POST /api/sessions/${id}/advance`, 'Session ended')
    return NextResponse.json({ status: 'ended' })
  }

  advanceStep(id, nextStep)
  emitEvent(id, { type: 'step_changed', step: nextStep, stepData: steps[nextStep] })
  logger.info(`POST /api/sessions/${id}/advance`, `Moved to step ${nextStep}`)

  return NextResponse.json({ current_step: nextStep, stepData: steps[nextStep] })
}
