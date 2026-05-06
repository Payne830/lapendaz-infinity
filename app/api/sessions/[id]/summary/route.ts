import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSteps, getResponses } from '@/lib/db'
import { generateSummary } from '@/lib/anthropic'
import { logger } from '@/lib/log'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = getSession(id)
  if (!session) { logger.warn(`POST /api/sessions/${id}/summary`, 'Session not found'); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const steps = getSteps(id)
  const responses = getResponses(id)
  logger.info(`POST /api/sessions/${id}/summary`, 'Generating summary', { steps: steps.length, responses: responses.length })

  const stepMap = new Map(steps.map(s => [s.id, s.title]))
  const enrichedResponses = responses.map(r => ({
    ...r,
    step_title: stepMap.get(r.step_id) || 'Unknown'
  }))

  try {
    const summary = await generateSummary(session.title, session.goal, steps, enrichedResponses)
    logger.info(`POST /api/sessions/${id}/summary`, 'Summary generated OK')
    return NextResponse.json({ summary })
  } catch (err) {
    logger.error(`POST /api/sessions/${id}/summary`, 'AI summary failed', { err: String(err) })
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 500 })
  }
}
