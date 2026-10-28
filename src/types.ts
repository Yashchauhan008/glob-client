export type User = { id: string; name: string; email: string; avatar_url?: string | null }
export type TeamMember = User & { created_at: string; ideas: number; tasks_done: number; last_active: string | null }

export const IDEA_STATUSES = ['idea', 'planning', 'building', 'paused', 'dropped', 'shipped'] as const
export const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
export const PRODUCT_STATUSES = ['up', 'down', 'building'] as const

export type Idea = {
  id: string; title: string; description: string; status: (typeof IDEA_STATUSES)[number]
  owner_name: string; problems: number; solutions: number; conclusions: number; messages: number; created_at: string
  feasibility: number | null; votes: number; my_vote: number | null; thoughts: number; contributors: string[]
  attachments?: number; cover?: string | null
}
export type Product = {
  id: string; name: string; url: string; description?: string; status: (typeof PRODUCT_STATUSES)[number]
  idea_id: string | null; idea_title: string | null
}
export type Todo = {
  id: string; title: string; done: boolean; due_date: string | null
  idea_id: string | null; product_id: string | null; lead_id: string | null
  idea_title: string | null; product_name: string | null; lead_name: string | null
}
export type Lead = {
  id: string; name: string; email: string | null; phone: string | null; company: string | null
  source: string | null; stage: (typeof STAGES)[number]; lost_reason: string | null
  next_follow_up_at: string | null; address: string | null
  latitude: number | null; longitude: number | null; owner_name?: string
}
export type Activity = { id: string; kind: string; body: string; owner_name: string; created_at: string }

export const STAGE_COLOR: Record<string, string> = {
  new: '#e4e7ee', contacted: '#d3e9f8', qualified: '#fbe9b8', proposal: '#f9d2e4',
  negotiation: '#fbd8c0', won: '#d3f2cc', lost: '#f3c9c6',
}
export const IDEA_COLOR: Record<string, string> = {
  idea: '#ffffff', planning: '#d3e9f8', building: '#e6d3f8', paused: '#e4e7ee',
  dropped: '#f3c9c6', shipped: '#d3f2cc',
}
export const PRODUCT_COLOR: Record<string, string> = { up: '#d3f2cc', down: '#f3c9c6', building: '#fbe9b8' }
export const EVENT_KINDS = ['meeting', 'appointment', 'task', 'reminder'] as const
export const KIND_COLOR: Record<string, string> = {
  meeting: '#d3e9f8', appointment: '#e6d3f8', task: '#fbe9b8', reminder: '#d3f2cc', followup: '#f9d2e4',
}
