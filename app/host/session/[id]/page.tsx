'use client'

import { useState, useEffect, useCallback, use } from 'react'
import QRCode from 'qrcode'

interface Step { id: string; step_order: number; type: string; title: string; content: string; is_question: number; image_url: string }
interface Response { id: string; participant_name: string; participant_role: string; content: string; type: string; step_id: string }
interface Participant { id: string; name: string; role: string }

const SESSION_SLIDE_BG: Record<string, string> = {
  intro:      'linear-gradient(135deg, #1A1200 0%, #2A1E00 100%)',
  slide:      'linear-gradient(135deg, #0A0E1A 0%, #111827 100%)',
  question:   'linear-gradient(135deg, #0D1A0D 0%, #1A2A1A 100%)',
  reflection: 'linear-gradient(135deg, #130D1A 0%, #1E1228 100%)',
  closing:    'linear-gradient(135deg, #1A0D0D 0%, #2A1212 100%)',
}
const SESSION_SLIDE_ACCENT: Record<string, string> = {
  intro: '#E8C97A', slide: '#90CDF4', question: '#9AE6B4', reflection: '#D6BCFA', closing: '#FBD38D',
}
function getSessionSlideBg(type: string) { return SESSION_SLIDE_BG[type] ?? SESSION_SLIDE_BG.slide }
function getSessionSlideAccent(type: string) { return SESSION_SLIDE_ACCENT[type] ?? '#C9A84C' }

export default function HostSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [session, setSession] = useState<{ title: string; status: string; current_step: number; live_mode: string } | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [qrUrl, setQrUrl] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [tunnelBase, setTunnelBase] = useState('')
  // tunnelInput initialized lazily from localStorage — never reset by effects
  const [tunnelInput, setTunnelInput] = useState('')
  const [showTunnelInput, setShowTunnelInput] = useState(false)
  const [summary, setSummary] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [started, setStarted] = useState(false)

  const currentStep = session ? steps[session.current_step] : null
  const currentMode = session?.live_mode ?? 'slide'
  const currentResponses = currentStep ? responses.filter(r => r.step_id === currentStep.id) : []

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}`)
    const data = await res.json()
    setSession(data.session)
    setSteps(data.steps)
    setResponses(data.responses)
    setParticipants(data.participants)
  }, [id])

  function updateQr(base: string) {
    const url = `${base}/join/${id}`
    setJoinUrl(url)
    QRCode.toDataURL(url, { width: 220, margin: 2, color: { dark: '#C9A84C', light: '#111827' } }).then(setQrUrl)
  }

  // Load session data only
  useEffect(() => {
    loadSession()
  }, [loadSession])

  // Initialize QR and tunnel base ONCE on mount — auto-detects from tunnel file
  useEffect(() => {
    async function initTunnel() {
      try {
        // Auto-detect from running tunnel process
        const res = await fetch('/api/tunnel-url')
        const { url: tunnelFileUrl } = await res.json()

        // Priority: tunnel file > localStorage > localhost
        const saved = localStorage.getItem('lapendaz_tunnel_base')
        const base = tunnelFileUrl || saved || window.location.origin

        if (tunnelFileUrl) {
          localStorage.setItem('lapendaz_tunnel_base', tunnelFileUrl)
        }

        setTunnelBase(base)
        setTunnelInput(tunnelFileUrl || saved || '')
        updateQr(base)
      } catch {
        const saved = localStorage.getItem('lapendaz_tunnel_base')
        const base = saved || window.location.origin
        setTunnelBase(base)
        setTunnelInput(saved || '')
        updateQr(base)
      }
    }
    initTunnel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function applyTunnel() {
    const raw = tunnelInput.trim().replace(/\/$/, '')
    if (!raw) return
    localStorage.setItem('lapendaz_tunnel_base', raw)
    setTunnelBase(raw)
    updateQr(raw)
    setShowTunnelInput(false)
  }

  function clearTunnel() {
    localStorage.removeItem('lapendaz_tunnel_base')
    const base = window.location.origin
    setTunnelBase(base)
    setTunnelInput('')
    updateQr(base)
    setShowTunnelInput(false)
  }

  useEffect(() => {
    const es = new EventSource(`/api/events/${id}`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'new_response') setResponses(prev => [...prev, data.response])
      if (data.type === 'step_changed') setSession(prev => prev ? { ...prev, current_step: data.step } : prev)
      if (data.type === 'mode_changed') setSession(prev => prev ? { ...prev, live_mode: data.mode } : prev)
      if (data.type === 'session_ended') setSession(prev => prev ? { ...prev, status: 'ended' } : prev)
      if (data.type === 'participant_joined') setParticipants(prev => prev.some(p => p.name === data.name) ? prev : [...prev, { id: data.name, name: data.name, role: data.role }])
    }
    return () => es.close()
  }, [id])

  async function startSession() {
    await fetch(`/api/sessions/${id}/advance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: 'start' }),
    })
    setStarted(true)
    setSession(prev => prev ? { ...prev, status: 'live' } : prev)
  }

  async function advance(direction: 'next' | 'prev' | 'end') {
    const res = await fetch(`/api/sessions/${id}/advance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    const data = await res.json()
    if (direction === 'end') {
      setSession(prev => prev ? { ...prev, status: 'ended' } : prev)
    } else {
      setSession(prev => prev ? { ...prev, current_step: data.current_step } : prev)
    }
  }

  async function setMode(mode: 'slide' | 'question') {
    await fetch(`/api/sessions/${id}/mode`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    setSession(prev => prev ? { ...prev, live_mode: mode } : prev)
  }

  async function generateSummary() {
    setLoadingSummary(true)
    const res = await fetch(`/api/sessions/${id}/summary`, { method: 'POST' })
    const data = await res.json()
    setSummary(data.summary)
    setLoadingSummary(false)
  }

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center">
      <div style={{ color: '#6B7A99' }}>Loading...</div>
    </div>
  )

  const isTunnel = tunnelBase && !tunnelBase.includes('localhost') && !tunnelBase.includes('192.168')

  return (
    <div className="min-h-screen flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ background: '#111827', borderBottom: '1px solid #2A3A4A' }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9A84C' }}>Lapendaz Infinity</span>
          {session.status === 'live' && <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#48BB78' }}><span className="live-dot" /> LIVE</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold truncate max-w-xs" style={{ color: '#F0F4FF' }}>{session.title}</span>
          <span className="text-xs" style={{ color: '#6B7A99' }}>{participants.length} joined</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">

          {/* PRE-SESSION */}
          {!started ? (
            <div className="fade-in flex flex-col items-center justify-center flex-1 gap-6">
              <div className="card w-full max-w-2xl">
                <h2 className="text-xl font-bold mb-1" style={{ color: '#F0F4FF' }}>{session.title}</h2>
                <p className="text-sm mb-6" style={{ color: '#6B7A99' }}>Share the QR code or link below. Start when everyone is ready.</p>

                <div className="flex gap-8 items-start">
                  {/* QR Code */}
                  <div className="flex-shrink-0 text-center">
                    {qrUrl && <img src={qrUrl} alt="QR" className="rounded-xl" style={{ width: 180 }} />}
                    <p className="text-xs mt-2" style={{ color: '#6B7A99' }}>Scan to join</p>
                    {isTunnel && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(72,187,120,0.15)', color: '#48BB78' }}>
                        Public URL
                      </span>
                    )}
                  </div>

                  {/* Session Flow + Controls */}
                  <div className="flex-1 min-w-0">
                    {/* Tunnel URL setter */}
                    <div className="mb-4 p-3 rounded-lg" style={{ background: '#0A0E1A', border: '1px solid #2A3A4A' }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold" style={{ color: '#C9A84C' }}>Join URL</p>
                        <button onClick={() => setShowTunnelInput(v => !v)} className="text-xs" style={{ color: '#6B7A99' }}>
                          {isTunnel ? '✓ Tunnel active' : '+ Set public URL'}
                        </button>
                      </div>
                      <p className="text-xs break-all" style={{ color: '#3A4A6A' }}>{joinUrl}</p>

                      {showTunnelInput && (
                        <div className="mt-2 space-y-2">
                          <input
                            className="input-field text-xs w-full"
                            placeholder="https://xxxx.trycloudflare.com"
                            value={tunnelInput}
                            onChange={e => setTunnelInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && applyTunnel()}
                          />
                          <div className="flex gap-2">
                            <button onClick={applyTunnel} className="btn-gold text-xs px-4 py-1.5 flex-1">Apply → Update QR</button>
                            {isTunnel && <button onClick={clearTunnel} className="btn-ghost text-xs px-3 py-1.5">Reset</button>}
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A84C' }}>Session Flow ({steps.length} steps)</p>
                    <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                      {steps.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className="text-xs w-5 text-center flex-shrink-0" style={{ color: '#3A4A6A' }}>{i + 1}</span>
                          <span className={`tag tag-${s.type} flex-shrink-0`}>{s.type}</span>
                          <span className="text-sm truncate" style={{ color: '#B0BDD0' }}>{s.title}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={startSession} className="btn-gold w-full text-center">🚀 Start Session</button>
                  </div>
                </div>
              </div>
            </div>

          ) : session.status === 'ended' ? (
            /* SESSION ENDED */
            <div className="fade-in flex flex-col gap-4 max-w-2xl mx-auto w-full">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold" style={{ color: '#F0F4FF' }}>Session Complete 🎉</h2>
                  <button onClick={generateSummary} disabled={loadingSummary} className="btn-gold text-sm px-5">
                    {loadingSummary ? '⏳ Generating...' : '✨ Generate Report'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Stat label="Participants" value={participants.length} />
                  <Stat label="Slides Covered" value={steps.length} />
                  <Stat label="Total Responses" value={responses.length} />
                </div>
                {summary ? (
                  <>
                    <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: '#0A0E1A', color: '#D0D8F0', maxHeight: 400, overflowY: 'auto' }}>
                      {summary}
                    </div>
                    <button
                      onClick={() => {
                        const blob = new Blob([summary], { type: 'text/plain' })
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(blob)
                        a.download = `${session.title}-report.txt`
                        a.click()
                      }}
                      className="btn-ghost text-sm mt-3"
                    >⬇ Download Report</button>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: '#6B7A99' }}>Click Generate Report to create an AI analysis and minutes.</p>
                )}
              </div>
            </div>

          ) : (
            /* LIVE SESSION */
            currentStep && (
              <div className="fade-in flex flex-col gap-4">
                {/* Progress bar */}
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all"
                      style={{ background: i < session.current_step ? '#C9A84C' : i === session.current_step ? '#E8C97A' : '#2A3A4A' }} />
                  ))}
                </div>

                {/* Current slide */}
                <div className="rounded-2xl overflow-hidden flex-1" style={{
                  minHeight: 340,
                  border: '1px solid #2A3A4A',
                  position: 'relative',
                  background: getSessionSlideBg(currentStep.type),
                }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: getSessionSlideAccent(currentStep.type) }} />
                  <div className="relative z-10 p-10 h-full flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`tag tag-${currentStep.type}`}>{currentStep.type}</span>
                      <span className="text-xs" style={{ color: '#3A4A6A' }}>
                        {session.current_step + 1} / {steps.length}
                      </span>
                    </div>
                    <h2 className="font-black mb-4 leading-tight" style={{ color: '#FFFFFF', fontSize: currentStep.title.length > 50 ? '1.6rem' : '2.2rem' }}>
                      {currentStep.title}
                    </h2>
                    <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', maxWidth: '80%' }}>
                      {currentStep.content}
                    </p>
                  </div>
                </div>

                {/* Mode toggle */}
                {currentStep.is_question === 1 && (
                  <div className="flex gap-3">
                    <button onClick={() => setMode('slide')} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                      style={{ background: currentMode === 'slide' ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : '#1E2A3A', color: currentMode === 'slide' ? '#0A0E1A' : '#6B7A99', border: currentMode === 'slide' ? 'none' : '1px solid #2A3A4A' }}>
                      📊 Slide Mode
                    </button>
                    <button onClick={() => setMode('question')} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                      style={{ background: currentMode === 'question' ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : '#1E2A3A', color: currentMode === 'question' ? '#0A0E1A' : '#6B7A99', border: currentMode === 'question' ? 'none' : '1px solid #2A3A4A' }}>
                      💬 Question Mode
                    </button>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex gap-3">
                  <button onClick={() => advance('prev')} disabled={session.current_step === 0}
                    className="btn-ghost flex-1 text-center" style={{ opacity: session.current_step === 0 ? 0.3 : 1 }}>
                    ← Prev
                  </button>
                  {session.current_step < steps.length - 1 ? (
                    <button onClick={() => advance('next')} className="btn-gold flex-1 text-center">Next →</button>
                  ) : (
                    <button onClick={() => advance('end')} className="btn-gold flex-1 text-center"
                      style={{ background: 'linear-gradient(135deg,#48BB78,#68D391)' }}>
                      End Session ✓
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="w-72 flex flex-col flex-shrink-0" style={{ borderLeft: '1px solid #2A3A4A', background: '#0D1220' }}>
          {/* Participants */}
          <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid #2A3A4A' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7A99' }}>Online ({participants.length})</p>
            {participants.length === 0
              ? <p className="text-xs" style={{ color: '#3A4A6A' }}>Waiting for participants...</p>
              : participants.map(p => (
                <div key={p.id} className="flex items-center gap-2 mb-1">
                  <span className="live-dot flex-shrink-0" />
                  <span className="text-xs flex-1 truncate" style={{ color: '#B0BDD0' }}>{p.name}</span>
                  <span className="text-xs" style={{ color: '#3A4A6A' }}>{p.role.replace('Chief ', '').replace(' Officer', '')}</span>
                </div>
              ))
            }
          </div>

          {/* Responses */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B7A99' }}>
              Responses ({currentResponses.length})
            </p>
            {currentResponses.length === 0
              ? <p className="text-xs" style={{ color: '#3A4A6A' }}>No responses yet.</p>
              : currentResponses.map(r => (
                <div key={r.id} className="card-dark fade-in mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: '#C9A84C' }}>{r.participant_name}</span>
                    {r.type === 'image' && <span className="text-xs" style={{ color: '#6B7A99' }}>📷</span>}
                  </div>
                  {r.type === 'image'
                    ? <img src={r.content} alt="response" className="rounded-lg w-full" />
                    : <p className="text-xs leading-relaxed" style={{ color: '#D0D8F0' }}>{r.content}</p>
                  }
                </div>
              ))
            }
          </div>

          {/* QR mini */}
          {started && session.status === 'live' && qrUrl && (
            <div className="p-3 text-center flex-shrink-0" style={{ borderTop: '1px solid #2A3A4A' }}>
              <img src={qrUrl} alt="QR" className="mx-auto rounded-lg" style={{ width: 80 }} />
              <p className="text-xs mt-1 break-all" style={{ color: '#3A4A6A', fontSize: 10 }}>{joinUrl}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-dark text-center">
      <p className="text-2xl font-black" style={{ color: '#C9A84C' }}>{value}</p>
      <p className="text-xs" style={{ color: '#6B7A99' }}>{label}</p>
    </div>
  )
}
