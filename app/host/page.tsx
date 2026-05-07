'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getSlideTheme } from '@/lib/atmosphere'

type WizardStep = 1 | 2

interface Context {
  title: string
  objective: string
  participants: string
  outcome: string
  duration: string
  atmosphere: string
  session_type: string
  attribution: string
}

interface Slide {
  id: string
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
const SESSION_TYPE_OPTIONS = ['Meeting', 'Workshop', 'Forum', 'Training']
const ATTRIBUTION_OPTIONS = [
  { value: 'named', label: 'Named', desc: 'Full name in report' },
  { value: 'role', label: 'Role Only', desc: 'e.g. "CEO"' },
  { value: 'anonymous', label: 'Anonymous', desc: 'No attribution' },
]
const STEP_LABELS = ['Context', 'Build Slides']
const DRAFT_KEY = 'lapendaz_draft_ctx'
const DRAFT_SLIDES_KEY = 'lapendaz_draft_slides'
const SESSIONS_KEY = 'lapendaz_saved_sessions'

interface SlidesDraft {
  ctx: Context
  slides: Slide[]
  slidePrompts: string[]
  savedAt: number
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const DEFAULT_CTX: Context = {
  title: '', objective: '', participants: '', outcome: '', duration: '',
  atmosphere: 'Inspirational', session_type: 'Meeting', attribution: 'named',
}

export default function HostPage() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(1)
  const [ctx, setCtx] = useState<Context>(DEFAULT_CTX)
  const [draftSaved, setDraftSaved] = useState(false)
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [slidesDraft, setSlidesDraft] = useState<SlidesDraft | null>(null)
  const slidesAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [slides, setSlides] = useState<Slide[]>([])
  const slidesRef = useRef<Slide[]>([])
  const slidePromptsRef = useRef<string[]>([])
  const [generatingSlides, setGeneratingSlides] = useState(false)
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)
  const [slidePrompts, setSlidePrompts] = useState<string[]>([])

  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const [aiDialog, setAiDialog] = useState<{ field: 'objective' | 'outcome'; step: number; answers: string[] } | null>(null)
  const [aiDialogInput, setAiDialogInput] = useState('')
  const [aiDialogLoading, setAiDialogLoading] = useState(false)

  const AI_QUESTIONS: Record<'objective' | 'outcome', string[]> = {
    objective: [
      'What is the ONE thing you most want participants to think or feel differently about after this session?',
      'What problem or opportunity is this session addressing right now in your organisation?',
      'What would make you say "this session was a success" immediately after it ends?',
    ],
    outcome: [
      'What specific action, decision, or commitment do you want each participant to make?',
      'How will you know — in 1 week — that this session had real impact?',
      'What do participants currently lack that this session should give them?',
    ],
  }

  async function submitAiDialog() {
    if (!aiDialog) return
    const answers = [...aiDialog.answers, aiDialogInput]
    if (aiDialog.step < 2) {
      setAiDialog({ ...aiDialog, step: aiDialog.step + 1, answers })
      setAiDialogInput('')
      return
    }
    // All 3 answers collected — call API
    setAiDialogLoading(true)
    try {
      const res = await fetch('/api/ai/refine-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: aiDialog.field, context: ctx, answers }),
      })
      const data = await res.json()
      if (data.content) updateCtx(aiDialog.field, data.content)
    } catch { /* ignore */ }
    setAiDialogLoading(false)
    setAiDialog(null)
    setAiDialogInput('')
  }

  // Load draft, slides draft, and saved sessions on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) setCtx(JSON.parse(draft))
      const sessions = localStorage.getItem(SESSIONS_KEY)
      if (sessions) setSavedSessions(JSON.parse(sessions))
      const sd = localStorage.getItem(DRAFT_SLIDES_KEY)
      if (sd) setSlidesDraft(JSON.parse(sd))
    } catch { /* ignore */ }
  }, [])

  // Keep refs in sync so async callbacks always read the latest values
  useEffect(() => { slidesRef.current = slides }, [slides])
  useEffect(() => { slidePromptsRef.current = slidePrompts }, [slidePrompts])

  // Auto-save slides whenever they change (debounced 1.5s)
  useEffect(() => {
    if (slides.length === 0) return
    if (slidesAutoSaveRef.current) clearTimeout(slidesAutoSaveRef.current)
    slidesAutoSaveRef.current = setTimeout(() => {
      try {
        const draft: SlidesDraft = { ctx, slides, slidePrompts, savedAt: Date.now() }
        localStorage.setItem(DRAFT_SLIDES_KEY, JSON.stringify(draft))
        setSlidesDraft(draft)
      } catch { /* ignore */ }
    }, 1500)
    return () => { if (slidesAutoSaveRef.current) clearTimeout(slidesAutoSaveRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, slidePrompts])

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

  function restoreSlidesDraft() {
    if (!slidesDraft) return
    setCtx(slidesDraft.ctx)
    setSlides(slidesDraft.slides)
    setSlidePrompts(slidesDraft.slidePrompts)
    setStep(2)
  }

  function discardSlidesDraft() {
    localStorage.removeItem(DRAFT_SLIDES_KEY)
    setSlidesDraft(null)
  }

  function saveAndExit() {
    try {
      const draft: SlidesDraft = { ctx, slides, slidePrompts, savedAt: Date.now() }
      localStorage.setItem(DRAFT_SLIDES_KEY, JSON.stringify(draft))
      setSlidesDraft(draft)
    } catch { /* ignore */ }
    setStep(1)
  }

  function step1Valid() {
    return ctx.title && ctx.objective && ctx.participants && ctx.outcome && ctx.duration && ctx.atmosphere && ctx.session_type && ctx.attribution
  }

  async function generateSlides() {
    setGeneratingSlides(true)
    setError('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    try {
      const res = await fetch('/api/ai/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const withIds = data.slides.map((s: Omit<Slide, 'id'>, i: number) => ({ ...s, id: `slide-${Date.now()}-${i}` }))
      const emptyPrompts = withIds.map(() => '')
      // Save slides immediately so a disconnect can't erase them
      try {
        const draft: SlidesDraft = { ctx, slides: withIds, slidePrompts: emptyPrompts, savedAt: Date.now() }
        localStorage.setItem(DRAFT_SLIDES_KEY, JSON.stringify(draft))
        setSlidesDraft(draft)
      } catch { /* ignore */ }
      setSlides(withIds)
      setSlidePrompts(emptyPrompts)
      setStep(2)
    } catch (e) {
      clearTimeout(timeout)
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Generation timed out — please try again.')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to generate slides')
      }
    }
    setGeneratingSlides(false)
  }

  async function regenerateSlide(index: number) {
    setRegeneratingIndex(index)
    setError('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const currentSlides = slidesRef.current
      const currentPrompts = slidePromptsRef.current
      if (!currentSlides[index]) throw new Error('Slide not found')
      const res = await fetch('/api/ai/regenerate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx, slide: currentSlides[index], prompt: currentPrompts[index] || '' }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (!res.ok || !data.slide) throw new Error(data.error || 'Rewrite failed')
      const updated = [...slidesRef.current]
      updated[index] = { ...data.slide, id: currentSlides[index].id }
      setSlides(updated)
      const updatedPrompts = [...slidePromptsRef.current]
      updatedPrompts[index] = ''
      setSlidePrompts(updatedPrompts)
    } catch (e) {
      clearTimeout(timeout)
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Rewrite timed out — please try again.')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to rewrite slide')
      }
    }
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

  function addSlide(afterIndex?: number) {
    const newSlide: Slide = { id: `slide-${Date.now()}`, type: 'slide', title: 'New Slide', content: '', is_question: false }
    if (afterIndex !== undefined) {
      const newSlides = [...slides]
      newSlides.splice(afterIndex + 1, 0, newSlide)
      const newPrompts = [...slidePrompts]
      newPrompts.splice(afterIndex + 1, 0, '')
      setSlides(newSlides)
      setSlidePrompts(newPrompts)
    } else {
      setSlides([...slides, newSlide])
      setSlidePrompts([...slidePrompts, ''])
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = slides.findIndex(s => s.id === active.id)
    const newIndex = slides.findIndex(s => s.id === over.id)
    setSlides(arrayMove(slides, oldIndex, newIndex))
    setSlidePrompts(arrayMove(slidePrompts, oldIndex, newIndex))
  }

  async function createAndLaunch() {
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

      try {
        const existing: SavedSession[] = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
        const updated = [{ id: data.id, title: ctx.title, savedAt: Date.now() }, ...existing].slice(0, 10)
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
        localStorage.removeItem(DRAFT_SLIDES_KEY)
        setSlidesDraft(null)
      } catch { /* ignore */ }

      router.push(`/host/session/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session')
      setLaunching(false)
    }
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
                  {i < 1 && <div className="w-8 h-px mx-2 flex-shrink-0" style={{ background: isDone ? '#48BB78' : '#2A3A4A' }} />}
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

              {/* Slides Draft Recovery Banner */}
              {slidesDraft && (
                <div className="card fade-in" style={{ borderColor: '#C9A84C60', background: 'rgba(201,168,76,0.06)' }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">📂</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: '#F0F4FF' }}>
                        Draft found: &ldquo;{slidesDraft.ctx.title || 'Untitled session'}&rdquo;
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7A99' }}>
                        {slidesDraft.slides.length} slides · Saved {formatRelativeTime(slidesDraft.savedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={restoreSlidesDraft} className="btn-gold text-sm flex-1 text-center">
                      Continue Building →
                    </button>
                    <button onClick={discardSlidesDraft} className="text-xs px-3 py-2 rounded-lg" style={{ color: '#6B7A99', background: '#1E2A3A' }}>
                      Discard
                    </button>
                  </div>
                </div>
              )}

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

                <FieldWithAI
                  label="1. What is the objective of this session?"
                  hint="e.g. Introduce AI tools, shift mindset from execution to strategy"
                  onAI={() => { setAiDialog({ field: 'objective', step: 0, answers: [] }); setAiDialogInput('') }}
                >
                  <textarea className="input-field" rows={2} placeholder="We want to..." value={ctx.objective} onChange={e => updateCtx('objective', e.target.value)} />
                </FieldWithAI>

                <Field label="2. Who are your participants?" hint="e.g. 7 senior Officers — CVO, CFO, CEO, CTO, CDO, CGO, CIO">
                  <textarea className="input-field" rows={2} placeholder="My participants are..." value={ctx.participants} onChange={e => updateCtx('participants', e.target.value)} />
                </Field>

                <FieldWithAI
                  label="3. What is the final outcome you want at the end of this session?"
                  hint="e.g. Each Officer leaves with one AI tool they will use this week"
                  onAI={() => { setAiDialog({ field: 'outcome', step: 0, answers: [] }); setAiDialogInput('') }}
                >
                  <textarea className="input-field" rows={2} placeholder="By the end, participants will..." value={ctx.outcome} onChange={e => updateCtx('outcome', e.target.value)} />
                </FieldWithAI>

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

                <Field label="6. What type of session is this?" hint="Determines the report format and depth">
                  <div className="flex flex-wrap gap-2">
                    {SESSION_TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => updateCtx('session_type', opt)}
                        className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                        style={{
                          background: ctx.session_type === opt ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : '#1E2A3A',
                          color: ctx.session_type === opt ? '#0A0E1A' : '#6B7A99',
                          border: ctx.session_type === opt ? 'none' : '1px solid #2A3A4A',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="7. How should participants be credited in the report?" hint="Applies to all responses recorded during the session">
                  <div className="flex flex-wrap gap-2">
                    {ATTRIBUTION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateCtx('attribution', opt.value)}
                        className="px-4 py-2 rounded-full text-sm font-semibold transition-all text-left"
                        style={{
                          background: ctx.attribution === opt.value ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : '#1E2A3A',
                          color: ctx.attribution === opt.value ? '#0A0E1A' : '#6B7A99',
                          border: ctx.attribution === opt.value ? 'none' : '1px solid #2A3A4A',
                        }}
                      >
                        <span className="font-bold">{opt.label}</span>
                        <span className="text-xs ml-2 opacity-70">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* AI Dialog overlay */}
              {aiDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
                  <div className="card w-full max-w-md fade-in" style={{ borderColor: 'rgba(201,168,76,0.4)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#C9A84C' }}>
                        ✨ AI Assistant — {aiDialog.field === 'objective' ? 'Objective' : 'Outcome'}
                      </p>
                      <button onClick={() => { setAiDialog(null); setAiDialogInput('') }} style={{ color: '#6B7A99' }}>✕</button>
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#F0F4FF' }}>
                      Question {aiDialog.step + 1} of 3
                    </p>
                    <p className="text-sm mb-4 leading-relaxed" style={{ color: '#B0BDD0' }}>
                      {AI_QUESTIONS[aiDialog.field][aiDialog.step]}
                    </p>
                    <textarea
                      className="input-field text-sm w-full"
                      rows={3}
                      placeholder="Your answer..."
                      value={aiDialogInput}
                      onChange={e => setAiDialogInput(e.target.value)}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submitAiDialog() }}
                    />
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={submitAiDialog}
                        disabled={!aiDialogInput.trim() || aiDialogLoading}
                        className="btn-gold flex-1 text-sm"
                      >
                        {aiDialogLoading ? <span className="flex items-center justify-center gap-2"><Spinner /> Writing...</span>
                          : aiDialog.step < 2 ? 'Next →' : '✨ Generate'}
                      </button>
                    </div>
                    {/* Progress dots */}
                    <div className="flex justify-center gap-2 mt-3">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= aiDialog.step ? '#C9A84C' : '#2A3A4A' }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                <div className="flex items-center gap-2">
                  <button onClick={saveAndExit} className="text-xs px-3 py-2 rounded-lg" style={{ color: '#6B7A99', background: '#1E2A3A', border: '1px solid #2A3A4A' }}>
                    💾 Save & Exit
                  </button>
                  <button onClick={createAndLaunch} disabled={launching} className="btn-gold px-6 text-sm">
                    {launching ? <span className="flex items-center gap-2"><Spinner /> Creating session...</span> : '🚀 Launch Session →'}
                  </button>
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {slides.map((s, i) => (
                    <div key={s.id}>
                      <SlideCard
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
                      {/* Insert button between slides */}
                      <div className="flex items-center justify-center py-1 opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => addSlide(i)}
                          className="text-xs px-3 py-1 rounded-full"
                          style={{ background: '#1E2A3A', color: '#6B7A99', border: '1px dashed #3A4A6A' }}
                        >
                          + Insert slide here
                        </button>
                      </div>
                    </div>
                  ))}
                </SortableContext>
              </DndContext>

              <button onClick={() => addSlide()} className="btn-ghost w-full text-sm text-center py-4" style={{ borderStyle: 'dashed' }}>
                + Add Slide
              </button>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2 flex items-center justify-between">
                  {error}
                  <button onClick={() => setError('')} className="ml-3 text-red-400 opacity-60 hover:opacity-100">✕</button>
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
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
  const titleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const { accent, bg } = getSlideTheme(atmosphere, slide.type)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  // Initialize contentEditable divs with current content when entering edit mode
  useEffect(() => {
    if (editing) {
      if (titleRef.current) titleRef.current.innerText = slide.title
      if (contentRef.current) contentRef.current.innerText = slide.content
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // Sync AI updates into contentEditable while editing.
  // Safe when not editing: refs are null (conditional render detaches them).
  useEffect(() => {
    if (titleRef.current && titleRef.current.innerText !== slide.title) {
      titleRef.current.innerText = slide.title
    }
  }, [slide.title])

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerText !== slide.content) {
      contentRef.current.innerText = slide.content
    }
  }, [slide.content])

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if (ev.target?.result) onUpdate('image_url', ev.target.result as string)
    }
    reader.readAsDataURL(file)
  }

  const bgStyle = slide.image_url
    ? `url(${slide.image_url}) center/cover no-repeat`
    : bg

  return (
    <div ref={setNodeRef} {...attributes} style={{ ...style, border: `1px solid ${editing ? accent + '60' : accent + '30'}`, borderRadius: 12, overflow: 'hidden' }}>

      {/* ── Visual Slide (WYSIWYG) ── */}
      <div className="relative group" style={{ minHeight: 220, background: bgStyle }}>
        {slide.image_url && (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,rgba(0,0,0,0.55),rgba(0,0,0,0.35))' }} />
        )}
        {!slide.image_url && (
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
        )}

        {/* Drag handle */}
        <div
          {...listeners}
          className="absolute top-3 left-3 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity select-none"
          style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: 1, padding: '4px 6px' }}
        >
          ⠿
        </div>

        <span className="absolute top-4 left-10 text-xs font-bold z-10" style={{ color: 'rgba(255,255,255,0.3)' }}>{index + 1}</span>

        <span className="absolute top-4 right-12 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider z-10"
          style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>
          {slide.type}
        </span>

        <button onClick={e => { e.stopPropagation(); onRemove() }}
          className="absolute top-4 right-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ color: 'rgba(255,255,255,0.5)' }}>✕</button>

        {/* WYSIWYG content area — click to edit inline */}
        <div className="relative z-10 px-8 py-8 ml-2" onClick={() => setEditing(true)}>
          {slide.is_question && (
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider select-none" style={{ color: accent }}>💬 Interaction Required</p>
          )}
          <div style={{ marginBottom: '0.75rem' }}>
            {editing ? (
              <div
                ref={titleRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onUpdate('title', e.currentTarget.innerText)}
                className="font-black leading-tight outline-none"
                style={{
                  color: '#FFFFFF',
                  fontSize: (slide.title || '').length > 40 ? '1.1rem' : '1.5rem',
                  cursor: 'text',
                  borderBottom: `1px solid ${accent}50`,
                  paddingBottom: 2,
                  minHeight: '1.5em',
                  textShadow: slide.image_url ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
                }}
              />
            ) : (
              <div
                className="font-black leading-tight"
                style={{
                  color: slide.title ? '#FFFFFF' : '#3A4A6A',
                  fontSize: (slide.title || '').length > 40 ? '1.1rem' : '1.5rem',
                  fontWeight: slide.title ? undefined : 400,
                  cursor: 'pointer',
                  minHeight: '1.5em',
                  textShadow: slide.image_url ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
                }}
              >
                {slide.title || 'Untitled — click to edit'}
              </div>
            )}
          </div>
          <div>
            {editing ? (
              <div
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => onUpdate('content', e.currentTarget.innerText)}
                className="text-sm leading-relaxed outline-none"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  cursor: 'text',
                  borderBottom: `1px solid ${accent}30`,
                  paddingBottom: 2,
                  minHeight: '2em',
                  textShadow: slide.image_url ? '0 1px 4px rgba(0,0,0,0.9)' : 'none',
                }}
              />
            ) : (
              <div
                className="text-sm leading-relaxed"
                style={{
                  color: slide.content ? 'rgba(255,255,255,0.65)' : '#3A4A6A',
                  cursor: 'pointer',
                  minHeight: '2em',
                  textShadow: slide.image_url ? '0 1px 4px rgba(0,0,0,0.9)' : 'none',
                }}
              >
                {slide.content || 'No content yet'}
              </div>
            )}
          </div>
        </div>

        {/* Bottom toolbar — visible in editing mode */}
        {editing && (
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-2 px-4 py-2" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
            <button onClick={() => setEditing(false)} className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Done ✓</button>
          </div>
        )}

        {!editing && (
          <div className="absolute bottom-3 right-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            Click to edit
          </div>
        )}
      </div>

      {/* ── Controls Panel (always visible, compact) ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap" style={{ background: '#0D1220', borderTop: `1px solid ${accent}20` }}>
        <select value={slide.type} onChange={e => onUpdate('type', e.target.value)}
          className="text-xs px-2 py-1 rounded-full font-semibold"
          style={{ background: '#0A0E1A', color: accent, border: `1px solid ${accent}50` }}>
          {['intro', 'slide', 'question', 'reflection', 'closing'].map(t => <option key={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: '#6B7A99' }}>
          <input type="checkbox" checked={slide.is_question} onChange={e => onUpdate('is_question', e.target.checked)} />
          💬 Response
        </label>

        <div className="flex gap-1.5 ml-auto items-center">
          {/* Photo upload */}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <button
            onClick={() => photoRef.current?.click()}
            className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: '#1E2A3A', color: '#6B7A99', border: '1px solid #2A3A4A' }}
          >
            📷 {slide.image_url ? 'Change' : 'Photo'}
          </button>
          {slide.image_url && (
            <button onClick={() => onUpdate('image_url', '')} className="text-xs px-2 py-1 rounded-full"
              style={{ color: '#6B7A99', background: '#1E2A3A', border: '1px solid #2A3A4A' }}>
              ✕ Photo
            </button>
          )}

          {/* AI regenerate */}
          <input
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: '#0A0E1A', color: '#6B7A99', border: '1px solid #2A3A4A', width: 160 }}
            placeholder="Prompt AI to rewrite..."
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onRegenerate() } }}
          />
          <button onClick={onRegenerate} disabled={regenerating} className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: accent + '20', color: accent, border: `1px solid ${accent}50` }}>
            {regenerating ? <Spinner /> : '↺'}
          </button>
        </div>
      </div>
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

function FieldWithAI({ label, hint, onAI, children }: { label: string; hint: string; onAI: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{label}</label>
        <button
          onClick={onAI}
          className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
          style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.35)' }}
        >
          ✨ AI
        </button>
      </div>
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
