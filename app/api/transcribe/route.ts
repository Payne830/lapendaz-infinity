import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  // Instantiate inside handler — build-time has no API keys, runtime does
  const openai = new OpenAI()
  const anthropic = new Anthropic()

  try {
    const formData = await req.formData()
    const file = formData.get('audio') as File | null
    const hint = (formData.get('hint') as string | null)?.trim() || ''

    if (!file || file.size < 500) {
      return NextResponse.json({ error: 'No audio data' }, { status: 400 })
    }

    // Whisper prompt: topic context + mixed-language signal
    // Keeps prompt under ~200 tokens; hint is dynamic from the current slide/question
    const whisperPrompt = hint
      ? `Professional event. Speakers may mix Chinese and English freely. Context: ${hint.slice(0, 220)}`
      : 'Professional event. Speakers may mix Chinese and English freely.'

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      prompt: whisperPrompt,
      // no language param — auto-detect handles mixed Chinese/English best
    })

    const rawText = transcription.text?.trim()
    if (!rawText) {
      return NextResponse.json({ error: 'No speech detected' }, { status: 400 })
    }

    // Claude Haiku pass: fix transcription errors without changing meaning or language mix
    const cleaned = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Clean up this voice transcription from a professional event (meeting, forum, workshop, or training).
${hint ? `Speaker was responding to: "${hint.slice(0, 180)}"` : ''}

Rules:
- Fix obvious transcription errors: wrong homophones, garbled phrases, missing syllables
- Preserve the speaker's exact language mix (Chinese, English, or both)
- Keep the original meaning and tone — do NOT add, summarise, or expand
- Return ONLY the corrected text, nothing else

Transcription:
${rawText}`,
      }],
    })

    const finalText =
      cleaned.content[0].type === 'text' ? cleaned.content[0].text.trim() : rawText

    return NextResponse.json({ text: finalText })
  } catch (err) {
    console.error('[transcribe]', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
