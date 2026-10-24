import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export type AgendaItem = {
  key: string; type: 'event' | 'todo' | 'followup'; id: string; title: string; kind: string
  when: Date; hasTime: boolean; end?: Date; notes?: string; who?: string; link?: string; done?: boolean
}

type Ev = { id: string; title: string; kind: string; starts_at: string; ends_at: string | null; notes: string; owner_name: string; idea_id: string | null; lead_id: string | null }
type Td = { id: string; title: string; done: boolean; due_date: string | null; idea_id: string | null; lead_id: string | null }
type Fu = { lead_id: string; lead_name: string; next_follow_up_at: string }

export function useAgenda(from: Date, to: Date) {
  return useQuery({
    queryKey: ['agenda', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const [ev, td] = await Promise.all([
        api.get<{ items: Ev[] }>(`/events?from=${from.toISOString()}&to=${to.toISOString()}`),
        api.get<{ items: Td[]; follow_ups: Fu[] }>('/todos?filter=open'),
      ])
      const items: AgendaItem[] = []
      ev.items.forEach((e) => items.push({
        key: 'e' + e.id, type: 'event', id: e.id, title: e.title, kind: e.kind, when: new Date(e.starts_at), hasTime: true,
        end: e.ends_at ? new Date(e.ends_at) : undefined, notes: e.notes, who: e.owner_name,
        link: e.idea_id ? `/ideas/${e.idea_id}` : e.lead_id ? `/leads/${e.lead_id}` : undefined,
      }))
      td.items.filter((t) => t.due_date).forEach((t) => {
        const d = new Date(t.due_date + 'T00:00:00')
        if (d >= from && d < to) items.push({ key: 't' + t.id, type: 'todo', id: t.id, title: t.title, kind: 'task', when: d, hasTime: false, link: '/tasks' })
      })
      td.follow_ups.forEach((f) => {
        const d = new Date(f.next_follow_up_at)
        if (d >= from && d < to) items.push({ key: 'f' + f.lead_id, type: 'followup', id: f.lead_id, title: `Follow up: ${f.lead_name}`, kind: 'followup', when: d, hasTime: true, link: `/leads/${f.lead_id}` })
      })
      return items.sort((a, b) => a.when.getTime() - b.when.getTime())
    },
  })
}

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const weekStart = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
export const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
export const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(/,/, ',')
