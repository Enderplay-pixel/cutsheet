import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'prompt' | 'subscribed' | 'loading'

/**
 * Web-Push-Abo des aktuellen Browsers verwalten.
 * 'unavailable' = Server hat keine VAPID-Keys konfiguriert → UI ausblenden.
 */
export function usePushSubscription() {
  const [state, setState] = useState<PushState>('loading')
  const [vapidKey, setVapidKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported')
        return
      }
      try {
        const res = await api.push.vapidKey()
        const key = res?.publicKey ?? res ?? null
        if (cancelled) return
        if (!key) { setState('unavailable'); return }
        setVapidKey(key)

        if (Notification.permission === 'denied') { setState('denied'); return }
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (cancelled) return
        setState(sub ? 'subscribed' : 'prompt')
      } catch {
        if (!cancelled) setState('unavailable')
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const subscribe = useCallback(async () => {
    if (!vapidKey) return false
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState('denied'); return false }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })
      await api.push.subscribe(sub.toJSON())
      setState('subscribed')
      return true
    } catch (err) {
      console.error('[push] subscribe failed', err)
      return false
    }
  }, [vapidKey])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.push.unsubscribe({ endpoint: sub.endpoint }).catch(() => null)
        await sub.unsubscribe()
      }
      setState('prompt')
      return true
    } catch {
      return false
    }
  }, [])

  return { state, subscribe, unsubscribe }
}
