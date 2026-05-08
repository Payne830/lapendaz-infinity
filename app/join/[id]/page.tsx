'use client'

import { useState, useEffect, use, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getSlideTheme } from '@/lib/atmosphere'

interface Step { id: string; title: string; content: string; type: string; is_question: number; image_url: string }

export default function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [phase, setPhase] = useState<'join' | 'waiting' | 'live' | 'ended' | 'closed'>('join')
  const [name, setName] = useState('')
  const role = 'Officer'
  const [sessionTitle, setSessionTitle] = useState('')
  const [sessionSummary, setSessionSummary] = useState('')
  const [atmosphere, setAtmosphere] = useState('Inspirational')
  const [steps, setSteps] = useState<Step[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [liveMode, setLiveMode] = useState<'slide' | 'question'>('slide')
  const [text, setText] = useState('')
  const [submittedResponses, setSubmittedResponses] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [waveformBars, setWaveformBars] = useState([0, 0, 0, 0, 0])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  function downloadPdf() {
    const content = reportRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${sessionTitle ?? 'Report'}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:48px;line-height:1.7;font-size:14px;max-width:820px;margin:0 auto}
    h1{font-size:1.4rem;font-weight:900;margin:0 0 0.5rem}
    h2{font-size:1rem;font-weight:700;margin:1.5rem 0 0.5rem;border-bottom:1px solid #ddd;padding-bottom:.25rem;color:#7a5a0a}
    h3{font-size:.95rem;font-weight:700;margin:1rem 0 .25rem;color:#2a4a7a}
    p{margin:.4rem 0}
    ul,ol{padding-left:1.5rem;margin:.4rem 0}
    li{margin:.2rem 0}
    blockquote{border-left:3px solid #C9A84C;padding-left:.75rem;font-style:italic;margin:.5rem 0;color:#555}
    strong{font-weight:700}em{color:#555}
    hr{border:none;border-top:1px solid #ddd;margin:1rem 0}
    table{width:100%;border-collapse:collapse;font-size:.85rem;margin:.5rem 0}
    th{background:#f5f0e0;font-weight:700;padding:.4rem .6rem;text-align:left;border:1px solid #ccc}
    td{padding:.35rem .6rem;border:1px solid #ccc}
    code{background:#f4f4f4;padding:.1rem .3rem;border-radius:3px;font-size:.8rem;font-family:monospace}
    @media print{body{padding:20px}}
  </style>
</head>
<body>${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const currentStep = steps[currentIndex]

  // Auto-rejoin if name was saved in localStorage (handles page refresh)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lapendaz_join_${id}`)
      if (saved) { setName(saved); handleJoin(saved) }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleJoin(joinName?: string) {
    const n = (joinName ?? name).trim()
    if (!n) { setError('Please enter your name'); return }
    const res = await fetch(`/api/sessions/${id}`)
    if (!res.ok) { setError('Session not found'); return }
    const data = await res.json()
    try { setAtmosphere(JSON.parse(data.session.context || '{}').atmosphere || 'Inspirational') } catch { /* use default */ }
    if (data.session.status === 'closed') {
      setSessionTitle(data.session.title)
      setSessionSummary(data.session.summary || '')
      setPhase('closed')
      return
    }
    if (data.session.status === 'ended') {
      setSessionTitle(data.session.title)
      setSessionSummary(data.session.summary || '')
      setPhase('ended')
      return
    }
    try { localStorage.setItem(`lapendaz_join_${id}`, n) } catch { /* ignore */ }
    setName(n)
    setSessionTitle(data.session.title)
    setSteps(data.steps)
    setCurrentIndex(data.session.current_step)
    setLiveMode(data.session.live_mode)
    setPhase(data.session.status === 'live' ? 'live' : 'waiting')
    await fetch(`/api/sessions/${id}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_name: n, participant_role: role }),
    })
  }

  // Reset response state when step/mode changes
  function resetResponseState() {
    setText('')
    setSubmittedResponses([])
    setError('')
  }

  // SSE — keep open in live/waiting/ended so we catch report_ready + session_closed
  useEffect(() => {
    if (phase !== 'live' && phase !== 'waiting' && phase !== 'ended') return
    const es = new EventSource(`/api/events/${id}`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'step_changed') { setCurrentIndex(data.step); setLiveMode('slide'); setPhase('live'); resetResponseState() }
      if (data.type === 'mode_changed') { setLiveMode(data.mode); resetResponseState() }
      if (data.type === 'session_ended') setPhase('ended')
      if (data.type === 'report_ready') setSessionSummary(data.summary)
      if (data.type === 'session_closed') setPhase('closed')
    }
    return () => es.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, phase])

  // Poll for step/status changes while live/waiting
  useEffect(() => {
    if (phase !== 'live' && phase !== 'waiting') return
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.session.status === 'ended') { setSessionSummary(data.session.summary || ''); setPhase('ended'); return }
        if (data.session.status === 'live') {
          setCurrentIndex(prev => prev !== data.session.current_step ? data.session.current_step : prev)
          setLiveMode(data.session.live_mode)
          setPhase('live')
        }
      } catch { /* ignore */ }
    }, 1000)
    return () => clearInterval(poll)
  }, [id, phase])

  // Poll in ended phase: detect report_ready (fallback) and session_closed
  useEffect(() => {
    if (phase !== 'ended') return
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.session.status === 'closed') { setSessionSummary(data.session.summary || ''); setPhase('closed'); return }
        if (data.session.summary && !sessionSummary) setSessionSummary(data.session.summary)
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(poll)
  }, [id, phase, sessionSummary])

  async function submitText() {
    if (!text.trim()) return
    setSubmitting(true)
    await fetch(`/api/sessions/${id}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_name: name, participant_role: role, type: 'text', content: text }),
    })
    setSubmittedResponses(prev => [...prev, text])
    setText('')
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
      setSubmittedResponses(prev => [...prev, '[图片已发送]'])
    }
    reader.readAsDataURL(file)
  }

  // Real waveform from AudioContext analyser
  function startWaveform(stream: MediaStream) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    ctx.createMediaStreamSource(stream).connect(analyser)
    audioCtxRef.current = ctx

    const data = new Uint8Array(analyser.frequencyBinCount)
    function tick() {
      analyser.getByteFrequencyData(data)
      // Sample 5 frequency bands across the spectrum
      const bars = [2, 5, 8, 11, 14].map(i => Math.max(8, Math.round((data[i] / 255) * 100)))
      setWaveformBars(bars)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  function stopWaveform() {
    cancelAnimationFrame(animFrameRef.current)
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setWaveformBars([0, 0, 0, 0, 0])
  }

  const toggleVoice = useCallback(async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop()
      return
    }

    // Check browser support before attempting
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('此浏览器不支持录音，请使用 Chrome 浏览器')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('此浏览器不支持录音，请使用 Chrome 浏览器')
      return
    }

    // Pick best supported MIME type (Huawei/Firefox/Chrome all differ)
    const MIME_CANDIDATES = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ]
    const mimeType = MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) ?? ''

    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      startWaveform(stream)

      const chunks: Blob[] = []
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      mr.onstop = async () => {
        stopWaveform()
        stream.getTracks().forEach(t => t.stop())
        setIsListening(false)

        const usedMime = mr.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: usedMime })
        if (blob.size < 500) { setError('录音太短，请重试'); return }

        setTranscribing(true)
        try {
          const ext = usedMime.includes('mp4') ? 'mp4' : usedMime.includes('ogg') ? 'ogg' : 'webm'
          const fd = new FormData()
          fd.append('audio', blob, `recording.${ext}`)
          // Pass current question as context so Whisper + Claude can improve accuracy
          if (currentStep) {
            fd.append('hint', `${currentStep.title}: ${currentStep.content}`.slice(0, 300))
          }
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.text?.trim()) {
            setText(prev => prev ? prev + ' ' + data.text.trim() : data.text.trim())
          } else {
            setError('未能识别语音，请重试')
          }
        } catch {
          setError('转录失败，请检查网络后重试')
        }
        setTranscribing(false)
      }

      mr.start()
      setIsListening(true)
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('请在浏览器设置里允许麦克风权限')
      } else if (name === 'NotFoundError') {
        setError('未检测到麦克风设备')
      } else {
        setError('无法启动录音，请检查麦克风')
      }
    }
  }, [isListening])

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
            <input className="input-field" placeholder="e.g. Eunice Tan" value={name}
              onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={() => handleJoin()} className="btn-gold w-full text-center">Enter →</button>
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
            <div key={i} className="w-2 h-2 rounded-full"
              style={{ background: '#C9A84C', animation: `pulse-gold 1.2s ${i * 0.2}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    </div>
  )

  /* ── ENDED ── */
  if (phase === 'ended') return (
    <div className="min-h-screen flex flex-col px-5 py-8" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="fade-in space-y-5">
        <div className="text-center pt-6 pb-2">
          <div className="text-4xl mb-3">🌟</div>
          <h1 className="text-2xl font-black mb-1" style={{ color: '#F0F4FF' }}>Session Complete</h1>
          {name && <p className="text-sm" style={{ color: '#6B7A99' }}>Thank you, {name}.</p>}
        </div>

        {sessionSummary ? (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#C9A84C' }}>
              {sessionTitle} — Session Report
            </p>
            <div ref={reportRef} className="rounded-xl p-4 report-body overflow-y-auto"
              style={{ background: '#111827', border: '1px solid #2A3A4A', maxHeight: '60vh' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sessionSummary}</ReactMarkdown>
            </div>
            <button onClick={downloadPdf} className="btn-gold w-full text-center text-sm">
              ⬇ Download Report (PDF)
            </button>
          </div>
        ) : (
          <div className="card text-center" style={{ borderColor: '#2A3A4A' }}>
            <p className="text-sm" style={{ color: '#6B7A99' }}>
              The host is generating the report. Refresh this page in a moment to see it.
            </p>
          </div>
        )}
      </div>
    </div>
  )

  /* ── CLOSED (host ended + closed the session) ── */
  if (phase === 'closed') return (
    <div className="min-h-screen flex flex-col px-5 py-8" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="fade-in space-y-5">
        {sessionSummary && (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#C9A84C' }}>
              {sessionTitle} — Session Report
            </p>
            <div ref={reportRef} className="rounded-xl p-4 report-body overflow-y-auto"
              style={{ background: '#111827', border: '1px solid #2A3A4A', maxHeight: '40vh' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sessionSummary}</ReactMarkdown>
            </div>
            <button onClick={downloadPdf} className="btn-ghost w-full text-center text-sm">
              ⬇ Download Report (PDF)
            </button>
          </div>
        )}
        <div className="card text-center space-y-4 py-8" style={{ borderColor: 'rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.04)' }}>
          <div className="text-4xl font-black" style={{ color: '#C9A84C' }}>∞</div>
          <h2 className="text-xl font-black" style={{ color: '#F0F4FF' }}>Host your own session</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#B0BDD0' }}>
            Run AI-powered meetings with live responses, real-time insights, and instant reports — just like this one.
          </p>
          <a href="/host" className="btn-gold block text-center text-sm">
            🚀 Create Your Session →
          </a>
          <p className="text-xs" style={{ color: '#3A4A6A' }}>Lapendaz Infinity · Powered by AI</p>
        </div>
      </div>
    </div>
  )

  /* ── LIVE ── */
  return (
    <div className="min-h-screen flex flex-col" style={{ maxHeight: '100dvh' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ background: '#111827', borderBottom: '1px solid #2A3A4A' }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C9A84C' }}>Lapendaz Infinity</span>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-xs font-semibold" style={{ color: '#48BB78' }}>LIVE</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-0.5 flex-shrink-0">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 h-1"
            style={{ background: i < currentIndex ? '#C9A84C' : i === currentIndex ? '#E8C97A' : '#2A3A4A' }} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {currentStep && (
          <>
            {/* Slide card */}
            {(() => {
              const { bg, accent } = getSlideTheme(atmosphere, currentStep.type)
              return (
            <div className="fade-in rounded-xl overflow-hidden" style={{
              border: `1px solid ${accent}30`, position: 'relative', minHeight: 260,
              background: currentStep.image_url ? `url(${currentStep.image_url}) center/cover no-repeat` : bg,
            }}>
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
              {currentStep.image_url && (
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(160deg,rgba(0,0,0,0.7),rgba(0,0,0,0.45))' }} />
              )}
              <div className="relative z-10 p-5 pl-6">
                <span className={`tag tag-${currentStep.type} mb-3 inline-block`}>{currentStep.type}</span>
                <h2 className="text-xl font-bold mb-2" style={{
                  color: '#FFFFFF',
                  textShadow: currentStep.image_url ? '0 2px 8px rgba(0,0,0,0.9)' : 'none',
                }}>{currentStep.title}</h2>
                <p className="text-sm leading-relaxed" style={{
                  color: currentStep.image_url ? 'rgba(255,255,255,0.88)' : '#B0BDD0',
                  textShadow: currentStep.image_url ? '0 1px 4px rgba(0,0,0,0.9)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>{currentStep.content}</p>
              </div>
            </div>
              )
            })()}

            {/* Question input — visible in question mode */}
            {liveMode === 'question' && currentStep.is_question === 1 && (
              <div className="card fade-in space-y-3">
                <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>Share your response</p>

                {/* Previously submitted answers for this question */}
                {submittedResponses.length > 0 && (
                  <div className="space-y-2">
                    {submittedResponses.map((r, i) => (
                      <div key={i} className="rounded-lg px-3 py-2 text-sm"
                        style={{ background: '#0D1829', border: '1px solid #1E3A2A' }}>
                        <span style={{ color: '#48BB78' }}>✓ </span>
                        <span style={{ color: '#B0BDD0' }}>{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Text input */}
                <textarea
                  className="input-field text-sm"
                  rows={4}
                  placeholder={submittedResponses.length > 0 ? 'Add more thoughts...' : 'Type your thoughts here...'}
                  value={text}
                  onChange={e => setText(e.target.value)}
                />

                {/* Real waveform bars — shown while recording */}
                {isListening && (
                  <div className="flex items-end gap-1 px-1" style={{ height: 28 }}>
                    <span className="text-xs mr-1 self-center" style={{ color: '#E8C97A' }}>Recording</span>
                    {waveformBars.map((h, i) => (
                      <div key={i} style={{
                        width: 4,
                        height: `${h}%`,
                        maxHeight: 24,
                        minHeight: 4,
                        borderRadius: 2,
                        background: '#C9A84C',
                        transition: 'height 0.1s ease',
                      }} />
                    ))}
                  </div>
                )}

                {/* Transcribing spinner */}
                {transcribing && (
                  <p className="text-xs" style={{ color: '#6B7A99' }}>Transcribing...</p>
                )}

                {/* Error */}
                {error && <p className="text-xs text-red-400">{error}</p>}

                {/* Action row */}
                <div className="flex gap-2">
                  {/* Voice button — always visible */}
                  <button
                    onClick={toggleVoice}
                    disabled={transcribing}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
                    style={{
                      background: isListening ? 'rgba(201,168,76,0.25)' : '#1E2A3A',
                      color: isListening ? '#E8C97A' : '#6B7A99',
                      border: `1px solid ${isListening ? '#C9A84C' : '#2A3A4A'}`,
                      minWidth: 76,
                    }}>
                    {isListening ? '⏹ Stop' : '🎙 Record'}
                  </button>

                  {/* Image upload */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-2 rounded-lg text-sm transition-all flex-shrink-0"
                    style={{ background: '#1E2A3A', color: '#6B7A99', border: '1px solid #2A3A4A' }}>
                    📷
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && submitImage(e.target.files[0])} />

                  {/* Submit */}
                  <button
                    onClick={submitText}
                    disabled={!text.trim() || submitting || transcribing}
                    className="btn-gold flex-1 text-center text-sm"
                    style={{ opacity: !text.trim() || submitting || transcribing ? 0.4 : 1 }}>
                    {submitting ? '...' : 'Send →'}
                  </button>
                </div>
              </div>
            )}

            {/* Listening indicator in slide mode */}
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
