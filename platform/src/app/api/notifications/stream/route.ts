import { NextRequest } from 'next/server'
import { subscribeToUserNotifications } from '@/lib/notifier'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return new Response('userId required', { status: 400 })

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('retry: 2000\n\n'))
      const onEvent = (payload: any) => {
        const s = `data: ${JSON.stringify(payload)}\n\n`
        controller.enqueue(new TextEncoder().encode(s))
      }
      const unsub = subscribeToUserNotifications(userId, onEvent)
      // cleanup on close
      ;(request.signal as any).addEventListener?.('abort', () => {
        unsub()
        try { controller.close() } catch {}
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }
  })
}
