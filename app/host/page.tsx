'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type WizardStep = 1 | 2 | 3

interface Context {
  title: string
  objective: string
  participants: string
  outcome: string
  duration: string
  atmosphere: string
}

interface Slide {
  type: 'intro' | 'slide' | 'question' | 'reflection' | 'closing'
  title: string
  content: string
  is_question: boolean
  image_url?: string
}

interface SavedSession {
  id: string
  title: string
  savedAt: number
}

const ATMOSPHERE_OPTIONS = ['Professional', 'Casual & Warm', 'Energetic', 'Inspirational', 'Structured & Formal']
const STEP_LABELS = ['Context', 'Build Slides', 'Ready to Launch']
const DRAFT_KEY = 'lapendaz_draft_ctx'
const SESSIONS_KEY = 'lapendaz_saved_sessions'

const DEFAULT_CTX: Context = {
  title: '', objective: '', participants: '', outcome: '', duration: '', atmosphere: 'Inspirational'
}

export default function HostPage() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(1)
  const [ctx, setCtx] = useState<Context>(DEFAULT_CTX)
  const [draftSaved, setDraftSaved] = useState(false)
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])

  const [slides, setSlides] = useState<Slide[]>([])
  const [generatingSlides, setGeneratingSlides] = useState(false)
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)
  const [slidePrompts, setSlidePrompts] = useState<string[]>([])

  const [launching, setLaunching] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [launchQr, setLaunchQr] = useState('')
  const [launchJoinUrl, setLaunchJoinUrl] = useState('')
  const [error, setError] = useState('')

  // Load draft and saved sessions on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) setCtx(JSON.parse(draft))
      const sessions = localStorage.getItem(SESSIONS_KEY)
      if (sessions) setSavedSessions(JSON.parse(sessions))
    } catch { /* ignore */ }
  }, [])

  // Auto-save draft whenever ctx changes
  useEffect(() => {
    if (!ctx.title && !ctx.objective) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(ctx))
      setDraftSaved(true)
      const t = setTimeout(() => setDraftSaved(false), 2000)
      return () => clearTimeout(t)
    } catch { /* ignore */ }
  }, [ctx])

  function updateCtx(key: keyof Context, val: string) {
    setCtx(prev => ({ ...prev, [key]: val }))
  }

  function clearDraft() {
    setCtx(DEFAULT_CTX)
    localStorage.removeItem(DRAFT_KEY)
  }

  function step1Valid() {
    return ctx.title && ctx.objective && ctx.participants && ctx.outcome && ctx.duration && ctx.atmosphere
  }

  async function generateSlides() {
    setGeneratingSlides(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSlides(data.slides)
      setSlidePrompts(data.slides.map(() => ''))
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate slides')
    }
    setGeneratingSlides(false)
  }

  async function regenerateSlide(index: number) {
    setRegeneratingIndex(index)
    try {
      const res = await fetch('/api/ai/regenerate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx, slide: slides[index], prompt: slidePrompts[index] }),
      })
      const data = await res.json()
      const updated = [...slides]
      updated[index] = data.slide
      setSlides(updated)
      const updatedPrompts = [...slidePrompts]
      updatedPrompts[index] = ''
      setSlidePrompts(updatedPrompts)
    } catch { /* ignore */ }
    setRegeneratingIndex(null)
  }

  function updateSlide(index: number, field: keyof Slide, value: string | boolean) {
    const updated = [...slides]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(updated[index] as any)[field] = value
    setSlides(updated)
  }

  function removeSlide(index: number) {
    setSlides(slides.filter((_, i) => i !== index))
    setSlidePrompts(slidePrompts.filter((_, i) => i !== index))
  }

  function addSlide() {
    setSlides([...slides, { type: 'slide', title: 'New Slide', content: '', is_question: false }])
    setSlidePrompts([...slidePrompts, ''])
  }

  async function goToStep3() {
    setLaunching(true)
    setError('')
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ctx.title,
          goal: ctx.objective,
          context: ctx,
          participant_count: 7,
          steps: slides,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Save to recent sessions
      try {
        const existing: SavedSession[] = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
        const updated = [{ id: data.id, title: ctx.title, savedAt: Date.now() }, ...existing].slice(0, 10)
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
      } catch { /* ignore */ }

      // Generate QR for waiting room
      const base = localStorage.getItem('lapendaz_tunnel_base') || window.location.origin
      const joinUrl = `${base}/join/${data.id}`
      setLaunchJoinUrl(joinUrl)
      setSessionId(data.id)

      const QRCode = (await import('qrcode')).default
      const qr = await QRCode.toDataURL(joinUrl, { width: 260, margin: 2, color: { dark: '#C9A84C', light: '#111827' } })
      setLaunchQr(qr)

      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session')
    }
    setLaunching(false)
  }

  function launch() {
    if (sessionId) router.push(`/host/session/${sessionId}`)
  }

  function deleteSession(id: string) {
    const updated = savedSessions.filter(s => s.id !== id)
    setSavedSessions(updated)
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div style={{ background: '#111827', borderBottom: '1px solid #2A3A4A' }} className="px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C9A84C' }}>
            Lapendaz Infinity · New Session
          </p>
          <div className="flex items-center gap-0">
            {STEP_LABELS.map((label, i) => {
              const num = (i + 1) as WizardStep
              const isActive = step === num
              const isDone = step > num
              return (
                <div key={label} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{
                        background: isActive ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : isDone ? '#2A4A2A' : '#1E2A3A',
                        color: isActive ? '#0A0E1A' : isDone ? '#48BB78' : '#3A4A6A',
                        border: isDone ? '1px solid #48BB78' : 'none',
                      }}
                    >
                      {isDone ? '✓' : num}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: isActive ? '#F0F4FF' : isDone ? '#48BB78' : '#3A4A6A' }}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && <div className="w-8 h-px mx-2 flex-shrink-0" style={{ background: isDone ? '#48BB78' : '#2A3A4A' }} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">

          {/* ── STEP 1: CONTEXT ── */}
          {step === 1 && (
            <div className="fade-in space-y-6">

              {/* Recent Sessions */}
              {savedSessions.length > 0 && (
                <div className="card" style={{ borderColor: '#C9A84C33' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#C9A84C' }}>
                    Recent Sessions
                  </p>
                  <div className="space-y-2">
                    {savedSessions.map(s => (
                      <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: '#0A0E1A' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#F0F4FF' }}>{s.title}</p>
                          <p className="text-xs" style={{ color: '#3A4A6A' }}>
                            {new Date(s.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => router.push(`/host/session/${s.id}`)}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold flex-shrink-0"
                          style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}
                        >
                          Reopen →
                        </button>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="text-xs px-2 py-1.5 rounded-lg flex-shrink-0"
                          style={{ color: '#3A4A6A', background: '#1E2A3A' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black" style={{ color: '#F0F4FF' }}>Session Context</h2>
                  <p className="text-sm mt-1" style={{ color: '#6B7A99' }}>Answer 5 questions. AI will design your entire session based on this.</p>
                </div>
                <div className="flex items-center gap-2">
                  {draftSaved && (
                    <span className="text-xs px-2 py-1 rounded" style={{ color: '#48BB78', background: 'rgba(72,187,120,0.1)' }}>
                      ✓ Draft saved
                    </span>
                  )}
                  {(ctx.title || ctx.objective) && (
                    <button onClick={clearDraft} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#6B7A99', background: '#1E2A3A' }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="card space-y-5">
                <Field label="Session Title" hint="Give your session a clear name">
                  <input className="input-field" placeholder="e.g. Officer AI Architecture Transformation" value={ctx.title} onChange={e => updateCtx('title', e.target.value)} />
                </Field>

                <Field label="1. What is the objective of this session?" hint="e.g. Introduce AI tools, shift mindset from execution to strategy">
                  <textarea className="input-field" rows={2} placeholder="We want to..." value={ctx.objective} onChange={e => updateCtx('objective', e.target.value)} />
                </Field>

                <Field label="2. Who are your participants?" hint="e.g. 7 senior Officers — CVO, CFO, CEO, CTO, CDO, CGO, CIO">
                  <textarea className="input-field" rows={2} placeholder="My participants are..." value={ctx.participants} onChange={e => updateCtx('participants', e.target.value)} />
                </Field>

                <Field label="3. What is the final outcome you want at the end of this session?" hint="e.g. Each Officer leaves with one AI tool they will use this week">
                  <textarea className="input-field" rows={2} placeholder="By the end, participants will..." value={ctx.outcome} onChange={e => updateCtx('outcome', e.target.value)} />
                </Field>

                <Field label="4. How long is your session?" hint="e.g. 90 minutes, 2 hours">
                  <input className="input-field" placeholder="e.g. 90 minutes" value={ctx.duration} onChange={e => updateCtx('duration', e.target.value)} />
                </Field>

                <Field label="5. What atmosphere would you like to create?" hint="Choose the tone for your session">
                  <div className="flex flex-wrap gap-2">
                    {ATMOSPHERE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => updateCtx('atmosphere', opt)}
                        className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                        style={{
                          background: ctx.atmosphere === opt ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : '#1E2A3A',
                          color: ctx.atmosphere === opt ? '#0A0E1A' : '#6B7A99',
                          border: ctx.atmosphere === opt ? 'none' : '1px solid #2A3A4A',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {error && <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}

              <button
                onClick={generateSlides}
                disabled={!step1Valid() || generatingSlides}
                className="btn-gold w-full text-center text-base"
                style={{ opacity: !step1Valid() ? 0.4 : 1 }}
              >
                {generatingSlides ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> AI is building your slides...
                  </span>
                ) : 'Generate Slides with AI →'}
              </button>
            </div>
          )}

          {/* ── STEP 2: BUILD SLIDES ── */}
          {step === 2 && (
            <div className="fade-in space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black" style={{ color: '#F0F4FF' }}>Build Slides</h2>
                  <p className="text-sm mt-1" style={{ color: '#6B7A99' }}>AI generated {slides.length} slides. Click any slide to edit.</p>
                </div>
                <button onClick={goToStep3} disabled={launching} className="btn-gold px-6 text-sm">
                  {launching ? <span className="flex items-center gap-2"><Spinner /> Creating session...</span> : 'Next: Launch →'}
                </button>
              </div>

              {slides.map((s, i) => (
                <SlideCard
                  key={i}
                  index={i}
                  slide={s}
                  atmosphere={ctx.atmosphere}
                  prompt={slidePrompts[i] || ''}
                  regenerating={regeneratingIndex === i}
                  onUpdate={(field, val) => updateSlide(i, field, val)}
                  onRemove={() => removeSlide(i)}
                  onPromptChange={val => { const p = [...slidePrompts]; p[i] = val; setSlidePrompts(p) }}
                  onRegenerate={() => regenerateSlide(i)}
                />
              ))}

              <button onClick={addSlide} className="btn-ghost w-full text-sm text-center py-4" style={{ borderStyle: 'dashed' }}>
                + Add Slide
              </button>
            </div>
          )}

          {/* ── STEP 3: QR WAITING ROOM ── */}
          {step === 3 && sessionId && (
            <div className="fade-in space-y-6 max-w-xl mx-auto">
              <div>
                <h2 className="text-2xl font-black" style={{ color: '#F0F4FF' }}>Ready to Launch</h2>
                <p className="text-sm mt-1" style={{ color: '#6B7A99' }}>
                  Session created · {slides.length} slides · Share the QR code and start when ready
                </p>
              </div>

              {/* QR Card */}
              <div className="card flex flex-col items-center gap-5 py-8" style={{ borderColor: '#C9A84C40' }}>
                {launchQr && (
                  <img src={launchQr} alt="Join QR" className="rounded-2xl" style={{ width: 220 }} />
                )}
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#C9A84C' }}>Join URL</p>
                  <p className="text-xs break-all" style={{ color: '#6B7A99' }}>{launchJoinUrl}</p>
                </div>
              </div>

              {/* Slide summary */}
              <div className="card-dark space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B7A99' }}>
                  Session Flow ({slides.length} steps)
                </p>
                {slides.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs w-5 text-center flex-shrink-0" style={{ color: '#3A4A6A' }}>{i + 1}</span>
                    <span className={`tag tag-${s.type} flex-shrink-0`}>{s.type}</span>
                    <span className="text-sm truncate" style={{ color: '#B0BDD0' }}>{s.title}</span>
                    {s.is_question && <span className="text-xs flex-shrink-0" style={{ color: '#9AE6B4' }}>💬</span>}
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}

              <button
                onClick={launch}
                className="btn-gold w-full text-center text-base"
                style={{ background: 'linear-gradient(135deg,#48BB78,#68D391)', color: '#0A0E1A' }}
              >
                🚀 Start Session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type SlideType = 'intro' | 'slide' | 'question' | 'reflection' | 'closing'

const ATMOSPHERE_PALETTES: Record<string, { accent: string; bgs: Record<SlideType, string> }> = {
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

function getSlideTheme(atmosphere: string, type: string): { accent: string; bg: string } {
  const palette = ATMOSPHERE_PALETTES[atmosphere] ?? ATMOSPHERE_PALETTES['Inspirational']
  const bg = palette.bgs[type as SlideType] ?? palette.bgs.slide
  return { accent: palette.accent, bg }
}

interface SlideCardProps {
  index: number
  slide: Slide
  atmosphere: string
  prompt: string
  regenerating: boolean
  onUpdate: (field: keyof Slide, val: string | boolean) => void
  onRemove: () => void
  onPromptChange: (val: string) => void
  onRegenerate: () => void
}

function SlideCard({ index, slide, atmosphere, prompt, regenerating, onUpdate, onRemove, onPromptChange, onRegenerate }: SlideCardProps) {
  const [editing, setEditing] = useState(false)
  const { accent, bg } = getSlideTheme(atmosphere, slide.type)

  return (
    <div className="fade-in rounded-xl overflow-hidden" style={{ border: `1px solid ${accent}30` }}>
      {/* ── Visual Slide Preview ── */}
      <div
        className="relative cursor-pointer group"
        style={{ minHeight: 220, background: bg }}
        onClick={() => setEditing(e => !e)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: accent }} />

        <span className="absolute top-4 left-5 text-xs font-bold z-10" style={{ color: 'rgba(255,255,255,0.3)' }}>{index + 1}</span>

        <span className="absolute top-4 right-12 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider z-10"
          style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>
          {slide.type}
        </span>

        <button onClick={e => { e.stopPropagation(); onRemove() }}
          className="absolute top-4 right-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ color: 'rgba(255,255,255,0.5)' }}>✕</button>

        <div className="relative z-10 px-8 py-8 ml-2">
          {slide.is_question && (
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: accent }}>💬 Interaction Required</p>
          )}
          <h3 className="font-black mb-3 leading-tight"
            style={{ color: '#FFFFFF', fontSize: slide.title.length > 40 ? '1.1rem' : '1.5rem' }}>
            {slide.title || <span style={{ color: '#3A4A6A' }}>Untitled slide</span>}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {slide.content
              ? slide.content.length > 160 ? slide.content.slice(0, 160) + '...' : slide.content
              : <span style={{ color: '#3A4A6A' }}>No content yet</span>}
          </p>
        </div>

        <div className="absolute bottom-3 right-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          {editing ? 'Collapse ↑' : 'Edit ↓'}
        </div>
      </div>

      {/* ── Edit Panel ── */}
      {editing && (
        <div className="p-4 space-y-3 fade-in" style={{ background: '#0D1220', borderTop: `1px solid ${accent}25` }}>
          <div className="flex items-center gap-3">
            <select value={slide.type} onChange={e => onUpdate('type', e.target.value)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold"
              style={{ background: '#0A0E1A', color: accent, border: `1px solid ${accent}` }}>
              {['intro', 'slide', 'question', 'reflection', 'closing'].map(t => <option key={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto" style={{ color: '#6B7A99' }}>
              <input type="checkbox" checked={slide.is_question} onChange={e => onUpdate('is_question', e.target.checked)} />
              Requires Response
            </label>
          </div>
          <input className="input-field text-sm font-semibold" value={slide.title} onChange={e => onUpdate('title', e.target.value)} placeholder="Slide title" />
          <textarea className="input-field text-sm" rows={4} value={slide.content} onChange={e => onUpdate('content', e.target.value)} placeholder="Slide content" />
          <div className="flex gap-2">
            <input className="input-field text-xs flex-1" placeholder="Tell AI how to improve this slide..."
              value={prompt} onChange={e => onPromptChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onRegenerate()} />
            <button onClick={onRegenerate} disabled={regenerating} className="btn-ghost text-xs px-3 flex-shrink-0">
              {regenerating ? <Spinner /> : '↺ Regenerate'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: '#C9A84C' }}>{label}</label>
      <p className="text-xs mb-2" style={{ color: '#6B7A99' }}>{hint}</p>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}
