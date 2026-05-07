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
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are a live session facilitator analysing participant responses in real-time.

Question asked: "${question.title}"
${question.content ? `Context: ${question.content}` : ''}

Participant responses (${responses.length} total):
${responseLines}

Analyse these responses and return a short, punchy live analysis. Structure:

**🔑 Main Themes** (2-3 bullet points — what patterns emerge)
**⭐ Standout Response** (quote the most insightful or unexpected one, name the participant)
**📊 Group Pulse** (1 sentence on overall direction/energy/consensus)
**💡 Facilitator Insight** (1 sentence — something clever, surprising, or worth highlighting to the room)

Keep it concise and energetic — this will be read aloud or shared on screen. Mix English and Chinese naturally if the responses do.`,
      }],
    })

    const analysis = result.content[0].type === 'text' ? result.content[0].text.trim() : ''
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('[analyse-responses]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
