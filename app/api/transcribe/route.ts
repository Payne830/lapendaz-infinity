import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI()

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('audio') as File | null
    if (!file || file.size < 500) {
      return NextResponse.json({ error: 'No audio data' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      // no language specified — Whisper auto-detects Chinese/English/mixed
    })

    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    console.error('[transcribe]', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
