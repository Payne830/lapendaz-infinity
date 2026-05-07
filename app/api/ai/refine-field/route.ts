import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic()
  try {
    const { field, context, answers } = await req.json() as {
      field: 'objective' | 'outcome'
      context: { title: string; participants: string; duration: string; atmosphere: string }
      answers: string[]
    }

    const fieldLabel = field === 'objective' ? 'session objective' : 'desired outcome'
    const fieldInstructions = field === 'objective'
      ? 'What this session aims to achieve — a clear, motivating purpose statement (2-3 sentences).'
      : 'What participants will walk away with — concrete, tangible, and inspiring (2-3 sentences).'

    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are helping a facilitator craft a precise ${fieldLabel} for their session.

Session title: "${context.title}"
Participants: "${context.participants}"
Duration: "${context.duration}"
Atmosphere: "${context.atmosphere}"

The facilitator answered 3 clarifying questions:
${answers.map((a, i) => `Q${i + 1}: ${a}`).join('\n')}

Based on their answers, write a polished ${fieldLabel} for this field.
${fieldInstructions}

Rules:
- Be specific, not generic
- Match the atmosphere and participant level
- Mix English and Chinese naturally if appropriate
- Return ONLY the field content, nothing else`,
      }],
    })

    const content = result.content[0].type === 'text' ? result.content[0].text.trim() : ''
    return NextResponse.json({ content })
  } catch (err) {
    console.error('[refine-field]', err)
    return NextResponse.json({ error: 'Failed to refine field' }, { status: 500 })
  }
}
