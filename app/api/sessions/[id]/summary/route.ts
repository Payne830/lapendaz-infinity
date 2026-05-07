import { NextRequest, NextResponse } from 'next/server'
import { getSession, getSteps, getResponses, saveSessionSummary } from '@/lib/db'
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

  let sessionType: 'Meeting' | 'Workshop' | 'Forum' | 'Training' = 'Meeting'
  let attribution: 'named' | 'role' | 'anonymous' = 'named'
  try {
    const ctx = session.context ? JSON.parse(session.context) : {}
    if (['Meeting', 'Workshop', 'Forum', 'Training'].includes(ctx.session_type)) sessionType = ctx.session_type
    if (['named', 'role', 'anonymous'].includes(ctx.attribution)) attribution = ctx.attribution
  } catch { /* context parse error — use defaults */ }

  try {
    const summary = await generateSummary(session.title, session.goal, steps, enrichedResponses, sessionType, attribution)
    saveSessionSummary(id, summary)
    logger.info(`POST /api/sessions/${id}/summary`, 'Summary generated OK')
    return NextResponse.json({ summary })
  } catch (err) {
    logger.error(`POST /api/sessions/${id}/summary`, 'AI summary failed', { err: String(err) })
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 500 })
  }
}
