import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { OPENAI_API_KEY } from '@/lib/config'

const ATMOSPHERE_STYLE: Record<string, string> = {
  'Professional':        'sleek corporate architecture, glass and steel, cool blue tones, minimal and sharp',
  'Casual & Warm':       'warm golden light, cozy natural textures, soft bokeh, earthy tones',
  'Energetic':           'dynamic motion blur, vibrant electric colors, bold geometry, high contrast',
  'Inspirational':       'vast cosmic nebula, dramatic light rays, human silhouette, gold and deep blue',
  'Structured & Formal': 'precise geometric patterns, monochromatic navy and silver, symmetrical composition',
}

const TYPE_MOOD: Record<string, string> = {
  intro:      'epic wide establishing shot, sense of arrival and wonder',
  slide:      'clean conceptual background, data visualization feel, abstract depth',
  question:   'intimate reflective space, soft spotlight, introspective mood',
  reflection: 'meditative calm, soft light through mist, inner journey',
  closing:    'horizon at sunrise, sense of beginning, hope and possibility',
}

export async function POST(req: NextRequest) {
  try {
    const { title, content, type, atmosphere } = await req.json()
    const client = new OpenAI({ apiKey: OPENAI_API_KEY })

    const atmosphereStyle = ATMOSPHERE_STYLE[atmosphere] || ATMOSPHERE_STYLE['Inspirational']
    const typeMood = TYPE_MOOD[type] || TYPE_MOOD['slide']

    const prompt = `A stunning cinematic background image for a presentation slide.

Concept: "${title}"
Context hint: ${content?.slice(0, 80) || ''}

Visual style: ${atmosphereStyle}
Mood: ${typeMood}

Requirements:
- Ultra-wide cinematic composition (16:9)
- Dark enough background (30-50% darkness) so white text can overlay it
- No text, no letters, no words, no numbers
- No people's faces (silhouettes are fine)
- Photorealistic or painterly — whichever suits the mood
- Premium, editorial quality
- Rich depth and atmosphere`

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
    })

    const imageUrl = response.data?.[0]?.url
    if (!imageUrl) throw new Error('No image returned')

    return NextResponse.json({ url: imageUrl })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
