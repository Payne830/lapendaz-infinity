import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-2xl fade-in">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full" style={{background: 'linear-gradient(135deg, #C9A84C, #E8C97A)'}} />
          <span className="text-2xl font-bold tracking-widest uppercase" style={{color: '#C9A84C', letterSpacing: '0.3em'}}>
            Lapendaz
          </span>
        </div>

        <h1 className="text-6xl font-black mb-3 tracking-tight" style={{color: '#F0F4FF'}}>
          INFINITY
        </h1>
        <p className="text-lg mb-2" style={{color: '#C9A84C'}}>无限的可能 · Infinite Possibilities</p>
        <p className="mb-12 text-base" style={{color: '#6B7A99'}}>
          AI-Guided Meeting & Transformation Platform
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/host" className="btn-gold text-center text-lg px-8 py-4">
            🎙 Host a Session
          </Link>
        </div>

        <p className="mt-8 text-sm" style={{color: '#3A4A6A'}}>
          Participants · Scan the QR code provided by your host to join
        </p>
      </div>
    </div>
  )
}
