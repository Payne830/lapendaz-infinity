import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const { context } = await req.json()
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const prompt = `You are an expert session architect for Lapendaz — a human-nature-first, education-led company.

Design a complete session flow for:

Title: ${context.title}
Objective: ${context.objective}
Participants: ${context.participants}
Desired Outcome: ${context.outcome}
Duration: ${context.duration}
Atmosphere: ${context.atmosphere}

Create 8-12 slides that guide participants through a meaningful journey.
Interleave question/reflection slides naturally after key concepts — do NOT put all questions at the end.

Return ONLY a valid JSON array, no explanation:
[
  {
    "type": "intro",
    "title": "Slide title",
    "content": "Engaging content. For content slides: insight or provocation (2-3 sentences). For question/reflection: one clear open question the participant should think about or respond to.",
    "is_question": false
  }
]

Types: intro, slide, question, reflection, closing
Rules:
- is_question: true ONLY for type "question" or "reflection"
- Distribute 2-4 question/reflection slides throughout the deck, not all at the end
- Each question slide should follow the concept slide it relates to
- Match the atmosphere: ${context.atmosphere}
- Pace for ${context.duration} — intro → build concepts → reflection points → closing
- Mix languages naturally if context suggests it (English + Chinese)
- Content must be specific to this session, not generic filler`

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
