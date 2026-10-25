import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export type Alerts = { ideas: number; qa: number; calendar: number; tasks: number; crm: number; products: number; activity: number }

const SEEN = 'glob_activity_seen'
const read = () => { try { return localStorage.getItem(SEEN) } catch { return null } }
const write = (v: string) => { try { localStorage.setItem(SEEN, v) } catch { /* private mode */ } }

/** What needs this person's attention, per nav item. Activity counts only what happened since they last opened it. */
export function useAlerts(pathname: string) {
  const [seen, setSeen] = useState(() => read() ?? (() => { const n = new Date().toISOString(); write(n); return n })())
  const onActivity = pathname === '/activity'
  useEffect(() => { if (onActivity) { const n = new Date().toISOString(); write(n); setSeen(n) } }, [onActivity])
  const q = useQuery({
    queryKey: ['alerts', seen],
    queryFn: () => api.get<Alerts>(`/alerts?since=${encodeURIComponent(seen)}`),
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  })
  const data = q.data
  return data ? { ...data, activity: onActivity ? 0 : data.activity } : null
}

export const ALERT_KEY: Record<string, keyof Alerts> = {
  '/ideas': 'ideas', '/qa': 'qa', '/calendar': 'calendar', '/tasks': 'tasks', '/leads': 'crm', '/products': 'products', '/activity': 'activity',
}

const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
export const ALERT_TIP: Record<keyof Alerts, (n: number) => string> = {
  ideas: (n) => `${s(n, 'idea', 'ideas')} waiting for your rating`,
  qa: (n) => `${s(n, 'open question', 'open questions')} you haven't answered`,
  calendar: (n) => `${s(n, 'event', 'events')} in the next 24 hours`,
  tasks: (n) => `${s(n, 'task', 'tasks')} due today or overdue`,
  crm: (n) => `${s(n, 'lead follow-up', 'lead follow-ups')} due`,
  products: (n) => `${s(n, 'product', 'products')} down`,
  activity: (n) => `${n} new ${n === 1 ? 'update' : 'updates'} since you last looked`,
}
