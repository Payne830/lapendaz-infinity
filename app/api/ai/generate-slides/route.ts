import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const { context } = await req.json()
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const prompt = `You are an expert session architect for Lapendaz — a human-nature-first, education-led company.

Design a complete slide deck for this session:

Title: ${context.title}
Objective: ${context.objective}
Participants: ${context.participants}
Desired Outcome: ${context.outcome}
Duration: ${context.duration}
Atmosphere: ${context.atmosphere}

Create 6-10 slides that guide participants through a meaningful journey.

Return ONLY valid JSON array, no explanation:
[
  {
    "type": "intro",
    "title": "Slide title",
    "content": "Rich, engaging content (2-4 sentences). For slides: share insight or provoke thought. For questions: state clearly what you want participants to reflect on.",
    "is_question": false
  }
]

Types: intro, slide, question, reflection, closing
Rules:
- is_question: true ONLY for type "question" or "reflection"
- Match the atmosphere: ${context.atmosphere}
- Duration is ${context.duration} — pace the content accordingly
- Slides should feel like a journey, building toward the outcome
- Mix languages naturally if context suggests it (English + Chinese)
- Make content specific, not generic`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Invalid AI response')
    const slides = JSON.parse(match[0])

    return NextResponse.json({ slides })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate slides' }, { status: 500 })
  }
}
