export type SlideType = 'intro' | 'slide' | 'question' | 'reflection' | 'closing' | 'image'

// ─── SESSION TONE ─────────────────────────────────────────────────────────────
// Used by AI to set the language and writing style of generated slides.
export const SESSION_TONES = [
  'Professional',
  'Casual & Warm',
  'Energetic',
  'Inspirational',
  'Structured & Formal',
  'Educational',
  'Playful',
  'Caring & Supportive',
] as const

export type SessionTone = typeof SESSION_TONES[number]

// ─── VISUAL THEMES ────────────────────────────────────────────────────────────
// Controls background, accent colour, and text colour of slides.
export interface ThemePalette {
  accent: string
  textPrimary: string
  textSecondary: string
  bgs: Record<SlideType, string>
  projectorSafe: boolean
}

export const VISUAL_THEMES: Record<string, ThemePalette> = {
  'Infinity': {
    accent: '#C9A84C',
    textPrimary: '#F0F4FF',
    textSecondary: '#8899BB',
    projectorSafe: true,
    bgs: {
      intro:      'linear-gradient(135deg, #1A1200 0%, #2A1E00 100%)',
      slide:      'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
      question:   'linear-gradient(135deg, #0D1A0D 0%, #1A2A1A 100%)',
      reflection: 'linear-gradient(135deg, #130D1A 0%, #1E1228 100%)',
      closing:    'linear-gradient(135deg, #1A0D0D 0%, #2A1212 100%)',
      image:      'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
    },
  },
  'Executive': {
    accent: '#7EB8F7',
    textPrimary: '#E8EDF5',
    textSecondary: '#7A90B0',
    projectorSafe: true,
    bgs: {
      intro:      'radial-gradient(ellipse at top right, #1a3a6a55 0%, transparent 60%), linear-gradient(160deg, #050d1a 0%, #0d1f3c 100%)',
      slide:      'radial-gradient(ellipse at bottom left, #0d264a44 0%, transparent 60%), linear-gradient(160deg, #040a14 0%, #081528 100%)',
      question:   'radial-gradient(ellipse at top left, #1a3a6a44 0%, transparent 55%), linear-gradient(160deg, #060d1c 0%, #0a1830 100%)',
      reflection: 'radial-gradient(ellipse at bottom right, #1a3a6a44 0%, transparent 55%), linear-gradient(160deg, #050c1a 0%, #091628 100%)',
      closing:    'radial-gradient(ellipse at top right, #1a3a6a55 0%, transparent 60%), linear-gradient(160deg, #050d1a 0%, #0d1f3c 100%)',
      image:      'linear-gradient(160deg, #040a14 0%, #081528 100%)',
    },
  },
  'Clean': {
    accent: '#3B6FE0',
    textPrimary: '#1a2035',
    textSecondary: '#556080',
    projectorSafe: true,
    bgs: {
      intro:      '#ffffff',
      slide:      '#f7f9fc',
      question:   '#eef3fb',
      reflection: '#f0f4ff',
      closing:    '#ffffff',
      image:      '#f0f4ff',
    },
  },
  'Nature': {
    accent: '#7EC87A',
    textPrimary: '#E8F0E4',
    textSecondary: '#6A8A66',
    projectorSafe: false,
    bgs: {
      intro:      'repeating-linear-gradient(45deg, transparent, transparent 40px, #7EC87A08 40px, #7EC87A08 41px), linear-gradient(145deg, #0d1f0d 0%, #1a3a1a 100%)',
      slide:      'repeating-linear-gradient(45deg, transparent, transparent 40px, #7EC87A06 40px, #7EC87A06 41px), linear-gradient(145deg, #080f08 0%, #0f1e0f 100%)',
      question:   'repeating-linear-gradient(45deg, transparent, transparent 40px, #7EC87A07 40px, #7EC87A07 41px), linear-gradient(145deg, #0a1a0a 0%, #152515 100%)',
      reflection: 'repeating-linear-gradient(45deg, transparent, transparent 40px, #7EC87A07 40px, #7EC87A07 41px), linear-gradient(145deg, #091509 0%, #122012 100%)',
      closing:    'repeating-linear-gradient(45deg, transparent, transparent 40px, #7EC87A08 40px, #7EC87A08 41px), linear-gradient(145deg, #0d1f0d 0%, #1a3a1a 100%)',
      image:      'linear-gradient(145deg, #080f08 0%, #0f1e0f 100%)',
    },
  },
  'Bold': {
    accent: '#FF6B35',
    textPrimary: '#FFFFFF',
    textSecondary: '#888888',
    projectorSafe: true,
    bgs: {
      intro:      'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px), #000000',
      slide:      'linear-gradient(#ffffff06 1px, transparent 1px), linear-gradient(90deg, #ffffff06 1px, transparent 1px), #050505',
      question:   'linear-gradient(#ffffff06 1px, transparent 1px), linear-gradient(90deg, #ffffff06 1px, transparent 1px), #080808',
      reflection: 'linear-gradient(#ffffff06 1px, transparent 1px), linear-gradient(90deg, #ffffff06 1px, transparent 1px), #060606',
      closing:    'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px), #000000',
      image:      '#050505',
    },
  },
  'Soft': {
    accent: '#9B6FD4',
    textPrimary: '#2d2040',
    textSecondary: '#7060a0',
    projectorSafe: false,
    bgs: {
      intro:      'radial-gradient(ellipse at top right, #c4a8e840 0%, transparent 55%), radial-gradient(ellipse at bottom left, #a8c4e840 0%, transparent 55%), linear-gradient(145deg, #f0ebf8 0%, #e8f0f8 100%)',
      slide:      'radial-gradient(ellipse at top left, #c4a8e830 0%, transparent 50%), linear-gradient(145deg, #f5f0fc 0%, #f0f5fc 100%)',
      question:   'radial-gradient(ellipse at bottom right, #a8c4e830 0%, transparent 50%), linear-gradient(145deg, #ece8f8 0%, #e8ecf8 100%)',
      reflection: 'radial-gradient(ellipse at top right, #c4a8e830 0%, transparent 50%), linear-gradient(145deg, #eee8f8 0%, #e8eef8 100%)',
      closing:    'radial-gradient(ellipse at bottom left, #c4a8e840 0%, transparent 55%), linear-gradient(145deg, #f0ebf8 0%, #e8f0f8 100%)',
      image:      'linear-gradient(145deg, #f5f0fc 0%, #f0f5fc 100%)',
    },
  },
  'Young': {
    accent: '#00E5CC',
    textPrimary: '#E0F8FF',
    textSecondary: '#5AABB8',
    projectorSafe: true,
    bgs: {
      intro:      'radial-gradient(ellipse at top right, #00E5CC22 0%, transparent 55%), radial-gradient(ellipse at bottom left, #0077FF18 0%, transparent 55%), linear-gradient(145deg, #040f18 0%, #0a1f30 100%)',
      slide:      'radial-gradient(ellipse at top left, #00E5CC18 0%, transparent 50%), linear-gradient(145deg, #030c14 0%, #071825 100%)',
      question:   'radial-gradient(ellipse at bottom right, #0077FF20 0%, transparent 50%), linear-gradient(145deg, #040e1c 0%, #081a2c 100%)',
      reflection: 'radial-gradient(ellipse at top right, #00E5CC18 0%, transparent 50%), linear-gradient(145deg, #040d1a 0%, #081828 100%)',
      closing:    'radial-gradient(ellipse at bottom left, #00E5CC20 0%, transparent 55%), linear-gradient(145deg, #040f18 0%, #0a1f30 100%)',
      image:      'linear-gradient(145deg, #030c14 0%, #071825 100%)',
    },
  },
  'Fun': {
    accent: '#FF6B9D',
    textPrimary: '#FFFFFF',
    textSecondary: '#BB8899',
    projectorSafe: true,
    bgs: {
      intro:      'radial-gradient(circle at 80% 20%, #FF6B9D28 0%, transparent 45%), radial-gradient(circle at 20% 80%, #FFD60A22 0%, transparent 45%), linear-gradient(145deg, #1a0828 0%, #2d0f3f 100%)',
      slide:      'radial-gradient(circle at 75% 25%, #FF6B9D20 0%, transparent 40%), linear-gradient(145deg, #120620 0%, #200a30 100%)',
      question:   'radial-gradient(circle at 25% 75%, #FFD60A20 0%, transparent 45%), radial-gradient(circle at 75% 25%, #FF6B9D18 0%, transparent 40%), linear-gradient(145deg, #160828 0%, #240d38 100%)',
      reflection: 'radial-gradient(circle at 50% 50%, #FF6B9D18 0%, transparent 50%), linear-gradient(145deg, #140726 0%, #220c36 100%)',
      closing:    'radial-gradient(circle at 80% 20%, #FF6B9D28 0%, transparent 45%), radial-gradient(circle at 20% 80%, #FFD60A22 0%, transparent 45%), linear-gradient(145deg, #1a0828 0%, #2d0f3f 100%)',
      image:      'linear-gradient(145deg, #120620 0%, #200a30 100%)',
    },
  },
}

export const DEFAULT_THEME = 'Infinity'

export function getSlideTheme(theme: string, type: string): { accent: string; bg: string; textPrimary: string; textSecondary: string } {
  const palette = VISUAL_THEMES[theme] ?? VISUAL_THEMES[DEFAULT_THEME]
  const bg = palette.bgs[type as SlideType] ?? palette.bgs.slide
  return { accent: palette.accent, bg, textPrimary: palette.textPrimary, textSecondary: palette.textSecondary }
}
