import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const { context, slide, prompt: userPrompt } = await req.json()
    if (!slide || !context) return NextResponse.json({ error: 'Missing slide or context' }, { status: 400 })
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const prompt = `You are regenerating ONE slide for a session called "${context.title}".
Session atmosphere: ${context.atmosphere}
Session objective: ${context.objective}

Current slide:
Title: ${slide.title}
Content: ${slide.content}
Type: ${slide.type}

User instruction: ${userPrompt || 'Improve this slide — make it more engaging and relevant.'}

Return ONLY a single JSON object (not an array):
{
  "type": "${slide.type}",
  "title": "improved title",
  "content": "improved content",
  "is_question": ${slide.is_question}
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Invalid response')
    const updatedSlide = JSON.parse(match[0])

    return NextResponse.json({ slide: updatedSlide })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to regenerate' }, { status: 500 })
  }
}
