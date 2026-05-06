import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const { context, slides } = await req.json()
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const slideTitles = slides.map((s: { title: string }) => s.title).join(', ')

    const prompt = `You are designing interaction questions for a session called "${context.title}".

Session objective: ${context.objective}
Participants: ${context.participants}
Desired outcome: ${context.outcome}
Atmosphere: ${context.atmosphere}
Slides covered: ${slideTitles}

Create 3-5 powerful interaction questions that:
- Build on the slide content
- Are open-ended and thought-provoking
- Match the ${context.atmosphere} atmosphere
- Progress from personal reflection to collective action

Return ONLY a valid JSON array:
[
  {
    "type": "question",
    "title": "Short question title",
    "content": "The full question — clear, specific, and engaging. Give a brief context if needed.",
    "is_question": true
  }
]`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Invalid response')
    const questions = JSON.parse(match[0])

    return NextResponse.json({ questions })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
