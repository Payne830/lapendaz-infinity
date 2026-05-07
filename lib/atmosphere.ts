export type SlideType = 'intro' | 'slide' | 'question' | 'reflection' | 'closing'

export const ATMOSPHERE_PALETTES: Record<string, { accent: string; bgs: Record<SlideType, string> }> = {
  'Professional': {
    accent: '#90CDF4',
    bgs: {
      intro:      'linear-gradient(135deg, #0D1B2A 0%, #1E3A5F 100%)',
      slide:      'linear-gradient(135deg, #0A1525 0%, #112035 100%)',
      question:   'linear-gradient(135deg, #091A2A 0%, #0E2535 100%)',
      reflection: 'linear-gradient(135deg, #0D1525 0%, #152535 100%)',
      closing:    'linear-gradient(135deg, #0D1B2A 0%, #1A3050 100%)',
    },
  },
  'Casual & Warm': {
    accent: '#F6AD55',
    bgs: {
      intro:      'linear-gradient(135deg, #2D1505 0%, #4A2510 100%)',
      slide:      'linear-gradient(135deg, #1A0E05 0%, #2D1A0A 100%)',
      question:   'linear-gradient(135deg, #1A1205 0%, #2D200A 100%)',
      reflection: 'linear-gradient(135deg, #200A05 0%, #351510 100%)',
      closing:    'linear-gradient(135deg, #2D1505 0%, #4A2510 100%)',
    },
  },
  'Energetic': {
    accent: '#F687B3',
    bgs: {
      intro:      'linear-gradient(135deg, #1A0530 0%, #2D0A4A 100%)',
      slide:      'linear-gradient(135deg, #0D0520 0%, #1A0A35 100%)',
      question:   'linear-gradient(135deg, #050D30 0%, #0A1A4A 100%)',
      reflection: 'linear-gradient(135deg, #200535 0%, #350A4A 100%)',
      closing:    'linear-gradient(135deg, #1A0530 0%, #2D0A4A 100%)',
    },
  },
  'Inspirational': {
    accent: '#E8C97A',
    bgs: {
      intro:      'linear-gradient(135deg, #1A1200 0%, #2A1E00 100%)',
      slide:      'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
      question:   'linear-gradient(135deg, #0D1A0D 0%, #1A2A1A 100%)',
      reflection: 'linear-gradient(135deg, #130D1A 0%, #1E1228 100%)',
      closing:    'linear-gradient(135deg, #1A0D0D 0%, #2A1212 100%)',
    },
  },
  'Structured & Formal': {
    accent: '#A0AEC0',
    bgs: {
      intro:      'linear-gradient(135deg, #0A0F14 0%, #1A2535 100%)',
      slide:      'linear-gradient(135deg, #080C10 0%, #12202E 100%)',
      question:   'linear-gradient(135deg, #080E0A 0%, #101A12 100%)',
      reflection: 'linear-gradient(135deg, #0A0810 0%, #14101E 100%)',
      closing:    'linear-gradient(135deg, #0A0F14 0%, #1A2535 100%)',
    },
  },
}

export function getSlideTheme(atmosphere: string, type: string): { accent: string; bg: string } {
  const palette = ATMOSPHERE_PALETTES[atmosphere] ?? ATMOSPHERE_PALETTES['Inspirational']
  const bg = palette.bgs[type as SlideType] ?? palette.bgs.slide
  return { accent: palette.accent, bg }
}
