type NotifListener = (payload: any) => void

const subscribers: Map<string, Set<NotifListener>> = new Map()

export function subscribeToUserNotifications(userId: string, cb: NotifListener) {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set())
  subscribers.get(userId)!.add(cb)
  return () => subscribers.get(userId)!.delete(cb)
}

export function publishNotification(userId: string, payload: any) {
  const set = subscribers.get(userId)
  if (!set) return
  for (const cb of set) {
    try { cb(payload) } catch { /* swallow */ }
  }
}

export function subscriberCount(userId: string) {
  return subscribers.get(userId)?.size ?? 0
}

export default { subscribeToUserNotifications, publishNotification, subscriberCount }
