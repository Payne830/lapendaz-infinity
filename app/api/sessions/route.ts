import { NextRequest, NextResponse } from 'next/server'
import { createSession, insertSteps } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/log'

const R = 'POST /api/sessions'

export async function POST(req: NextRequest) {
  try {
    const { title, goal, context, steps: prebuiltSteps } = await req.json()
    if (!title) { logger.warn(R, 'Missing title'); return NextResponse.json({ error: 'Missing title' }, { status: 400 }) }
    if (!prebuiltSteps || prebuiltSteps.length === 0) { logger.warn(R, 'No slides provided'); return NextResponse.json({ error: 'No slides provided' }, { status: 400 }) }

    const sessionId = uuidv4()
    logger.info(R, 'Creating session', { sessionId, title, stepCount: prebuiltSteps.length })
    createSession(sessionId, title, goal || title, context || {})

    const steps = prebuiltSteps.map((s: { type: string; title: string; content: string; is_question: boolean; image_url?: string }, i: number) => ({
      id: uuidv4(),
      session_id: sessionId,
      step_order: i,
      type: s.type,
      title: s.title,
      content: s.content,
      is_question: s.is_question,
      image_url: s.image_url || '',
    }))

    insertSteps(steps)
    logger.info(R, 'Session created', { sessionId, stepCount: steps.length })
    return NextResponse.json({ id: sessionId, steps })
  } catch (err) {
    logger.error(R, 'Failed to create session', { err: String(err) })
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
