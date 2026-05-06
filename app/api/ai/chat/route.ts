import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const systemMsg = messages.find((m: { role: string }) => m.role === 'system')
    const chatMessages = messages.filter((m: { role: string }) => m.role !== 'system')

    const finalMessages = chatMessages.length === 0
      ? [{ role: 'user', content: 'Start the co-creation process.' }]
      : chatMessages

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemMsg?.content || '',
      messages: finalMessages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }
}
