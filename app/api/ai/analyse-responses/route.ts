import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic()
  try {
    const { question, responses } = await req.json() as {
      question: { title: string; content: string }
      responses: Array<{ participant_name: string; content: string }>
    }

    if (!responses || responses.length === 0) {
      return NextResponse.json({ error: 'No responses to analyse' }, { status: 400 })
    }

    const responseLines = responses.map((r, i) =>
      `${i + 1}. [${r.participant_name}]: ${r.content}`
    ).join('\n')

    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      messages: [{
        role: 'user',
        content: `You are a live session facilitator. Analyse these ${responses.length} responses BRIEFLY.

Question: "${question.title}"

Responses:
${responseLines}

Return EXACTLY this structure — no extra text, no paragraphs:

**📊 Patterns** (max 3 bullets, each ≤10 words, include frequency if repeated e.g. "3/5 want X")
• ...
• ...

**⭐ Best Quote** — [Name]: "exact short quote"

**💡 3 Insights for Facilitator**
1. (≤12 words)
2. (≤12 words)
3. (≤12 words)

Match the language of the responses (Chinese/English/mixed).`,
      }],
    })

    const analysis = result.content[0].type === 'text' ? result.content[0].text.trim() : ''
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('[analyse-responses]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
