import { NextRequest } from 'next/server'
import { subscribe } from '@/lib/events'
import { logger } from '@/lib/log'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  logger.info(`GET /api/events/${id}`, 'SSE client connected')

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      const unsubscribe = subscribe(id, (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          logger.warn(`GET /api/events/${id}`, 'SSE write failed — client disconnected')
          unsubscribe()
        }
      })

      // Heartbeat every 25s to keep Cloudflare tunnel alive (100s timeout)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          logger.warn(`GET /api/events/${id}`, 'Heartbeat failed — closing SSE')
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 25000)

      return () => {
        logger.info(`GET /api/events/${id}`, 'SSE client disconnected')
        clearInterval(heartbeat)
        unsubscribe()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}
