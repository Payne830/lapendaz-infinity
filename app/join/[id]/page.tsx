'use client'

import { useState, useEffect, use, useRef } from 'react'

interface Step { id: string; title: string; content: string; type: string; is_question: number; image_url: string }

const ROLES = [
  'Chief Innovation Officer', 'Chief Growth Officer', 'Chief Development Officer',
  'Chief Technology Officer', 'Chief Financial Officer', 'Chief Visual Officer',
  'Chief Executive Officer', 'Guest',
]

export default function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [phase, setPhase] = useState<'join' | 'waiting' | 'live' | 'ended'>('join')
  const [name, setName] = useState('')
  const role = 'Officer'
  const [sessionTitle, setSessionTitle] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [liveMode, setLiveMode] = useState<'slide' | 'question'>('slide')
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const isPressingRef = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const currentStep = steps[currentIndex]

  async function handleJoin() {
    if (!name.trim()) { setError('Please enter your name'); return }
    const res = await fetch(`/api/sessions/${id}`)
    if (!res.ok) { setError('Session not found'); return }
    const data = await res.json()
    if (data.session.status === 'ended') { setPhase('ended'); return }
    setSessionTitle(data.session.title)
    setSteps(data.steps)
    setCurrentIndex(data.session.current_step)
    setLiveMode(data.session.live_mode)
    setPhase(data.session.status === 'live' ? 'live' : 'waiting')
    // Register participant on join so host sees them online
    await fetch(`/api/sessions/${id}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_name: name, participant_role: role }),
    })
  }

  useEffect(() => {
    if (phase !== 'live' && phase !== 'waiting') return

    // SSE for real-time events
    const es = new EventSource(`/api/events/${id}`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'step_changed') {
        setCurrentIndex(data.step)
        setText('')
        setSubmitted(false)
        setLiveMode('slide')
        setPhase('live')
      }
      if (data.type === 'mode_changed') {
        setLiveMode(data.mode)
        setSubmitted(false)
        setText('')
      }
      if (data.type === 'session_ended') setPhase('ended')
    }

    // Polling fallback — syncs state every 3s in case SSE drops through tunnel
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.session.status === 'ended') { setPhase('ended'); return }
        if (data.session.status === 'live') {
          setCurrentIndex(prev => prev !== data.session.current_step ? data.session.current_step : prev)
          setLiveMode(data.session.live_mode)
          setPhase('live')
        }
      } catch { /* ignore */ }
    }, 1000)

    return () => { es.close(); clearInterval(poll) }
  }, [id, phase])

  async function submitText() {
    if (!text.trim()) return
    setSubmitting(true)
    await fetch(`/api/sessions/${id}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_name: name, participant_role: role, type: 'text', content: text }),
    })
    setText('')
    setSubmitted(true)
    setSubmitting(false)
  }

  async function submitImage(file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      await fetch(`/api/sessions/${id}/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_name: name, participant_role: role, type: 'image', content: dataUrl }),
      })
      setSubmitted(true)
    }
    reader.readAsDataURL(file)
  }

  function toggleVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition
    if (!SR) { setError('请用 Chrome 浏览器开启语音功能'); return }

    if (isListening) {
      isPressingRef.current = false
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setIsListening(false)
      return
    }

    isPressingRef.current = true
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as unknown[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript).join('')
      setText(t)
    }
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setError('请在浏览器设置里允许麦克风权限')
        setIsListening(false)
        isPressingRef.current = false
      }
    }
    rec.onend = () => {
      if (isPressingRef.current) {
        try { rec.start() } catch { /* restart failed, stop */ }
      } else {
        setIsListening(false)
      }
    }
    recognitionRef.current = rec
    try {
      rec.start()
      setIsListening(true)
    } catch {
      setError('语音启动失败，请重试')
    }
  }

  /* ── JOIN ── */
  if (phase === 'join') return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#C9A84C' }}>Lapendaz Infinity</p>
          <h1 className="text-2xl font-black" style={{ color: '#F0F4FF' }}>Join Session</h1>
        </div>
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#C9A84C' }}>Your Name</label>
            <input className="input-field" placeholder="e.g. Eunice Tan" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={handleJoin} className="btn-gold w-full text-center">Enter →</button>
        </div>
      </div>
    </div>
  )

  /* ── WAITING ── */
  if (phase === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="text-center fade-in">
        <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl"
          style={{ background: 'linear-gradient(135deg,#C9A84C,#E8C97A)' }}>∞</div>
        <h2 className="text-xl font-bold mb-1" style={{ color: '#F0F4FF' }}>{sessionTitle}</h2>
        <p className="text-sm mb-1" style={{ color: '#6B7A99' }}>Welcome, {name}</p>
        <p className="text-sm" style={{ color: '#3A4A6A' }}>Waiting for the host to start...</p>
        <div className="flex gap-1 justify-center mt-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: '#C9A84C', animation: `pulse-gold 1.2s ${i * 0.2}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    </div>
  )

  /* ── ENDED ── */
  if (phase === 'ended') return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="text-center fade-in">
        <div className="text-4xl mb-4">🌟</div>
        <h1 className="text-2xl font-black mb-2" style={{ color: '#F0F4FF' }}>Session Complete</h1>
        <p className="text-sm" style={{ color: '#6B7A99' }}>Thank you, {name}. Your host will share the report with you.</p>
      </div>
    </div>
  )

  /* ── LIVE ── */
  return (
    <div className="min-h-screen flex flex-col" style={{ maxHeight: '100dvh' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: '#111827', borderBottom: '1px solid #2A3A4A' }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9A84C' }}>Lapendaz Infinity</span>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-xs font-semibold" style={{ color: '#48BB78' }}>LIVE</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-0.5 flex-shrink-0">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 h-1"
            style={{ background: i < currentIndex ? '#C9A84C' : i === currentIndex ? '#E8C97A' : '#2A3A4A' }} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {currentStep && (
          <>
            {/* Slide content — always visible */}
            <div className="fade-in rounded-xl overflow-hidden" style={{ border: '1px solid #2A3A4A', position: 'relative', minHeight: 180,
              background: currentStep.image_url ? `url(${currentStep.image_url}) center/cover no-repeat` : '#111827' }}>
              {currentStep.image_url && <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,rgba(0,0,0,0.7),rgba(0,0,0,0.45))' }} />}
              <div className="relative z-10 p-5">
                <span className={`tag tag-${currentStep.type} mb-3 inline-block`}>{currentStep.type}</span>
                <h2 className="text-xl font-bold mb-2" style={{ color: '#FFFFFF', textShadow: currentStep.image_url ? '0 2px 8px rgba(0,0,0,0.9)' : 'none' }}>{currentStep.title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: currentStep.image_url ? 'rgba(255,255,255,0.88)' : '#B0BDD0', textShadow: currentStep.image_url ? '0 1px 4px rgba(0,0,0,0.9)' : 'none' }}>{currentStep.content}</p>
              </div>
            </div>

            {/* Question input — only in question mode */}
            {liveMode === 'question' && currentStep.is_question === 1 && (
              <div className="card fade-in space-y-3">
                <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>
                  {submitted ? '✅ Response received' : 'Share your response'}
                </p>

                {submitted ? (
                  <div>
                    <p className="text-xs mb-3" style={{ color: '#6B7A99' }}>Your response was sent. You can add more thoughts:</p>
                    <textarea className="input-field text-sm" rows={3} placeholder="Add another thought..." value={text} onChange={e => setText(e.target.value)} />
                    <button onClick={submitText} disabled={!text.trim() || submitting} className="btn-gold w-full text-center text-sm mt-2">
                      Send More
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      className="input-field text-sm"
                      rows={4}
                      placeholder="Type your thoughts here..."
                      value={text}
                      onChange={e => setText(e.target.value)}
                    />

                    <div className="flex gap-2">
                      {/* Voice — tap to start/stop */}
                      <button onClick={toggleVoice}
                        className="px-3 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
                        style={{
                          background: isListening ? 'rgba(201,168,76,0.25)' : '#1E2A3A',
                          color: isListening ? '#E8C97A' : '#6B7A99',
                          border: `1px solid ${isListening ? '#C9A84C' : '#2A3A4A'}`,
                        }}>
                        {isListening ? '🔴 停止' : '🎙 录音'}
                      </button>

                      {/* Image upload */}
                      <button onClick={() => fileRef.current?.click()}
                        className="px-3 py-2 rounded-lg text-sm transition-all flex-shrink-0"
                        style={{ background: '#1E2A3A', color: '#6B7A99', border: '1px solid #2A3A4A' }}>
                        📷
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && submitImage(e.target.files[0])} />

                      {/* Submit */}
                      <button onClick={submitText} disabled={!text.trim() || submitting}
                        className="btn-gold flex-1 text-center text-sm"
                        style={{ opacity: !text.trim() ? 0.4 : 1 }}>
                        {submitting ? '...' : 'Send →'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Slide mode indicator when question step is in slide mode */}
            {liveMode === 'slide' && currentStep.is_question === 1 && (
              <div className="text-center py-3">
                <p className="text-xs" style={{ color: '#3A4A6A' }}>Listening to the host...</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 flex-shrink-0 text-center" style={{ borderTop: '1px solid #1E2A3A' }}>
        <p className="text-xs" style={{ color: '#3A4A6A' }}>{name} · {role}</p>
      </div>
    </div>
  )
}
