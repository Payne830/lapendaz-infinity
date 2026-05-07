import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'infinity.db')

let db: Database.Database

function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT '',
      context TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'setup',
      live_mode TEXT NOT NULL DEFAULT 'slide',
      current_step INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      step_order INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_question INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      step_id TEXT NOT NULL REFERENCES steps(id),
      participant_name TEXT NOT NULL,
      participant_role TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  try {
    getDb().exec(`ALTER TABLE sessions ADD COLUMN context TEXT NOT NULL DEFAULT '{}'`)
  } catch { /* column already exists */ }
  try {
    getDb().exec(`ALTER TABLE sessions ADD COLUMN live_mode TEXT NOT NULL DEFAULT 'slide'`)
  } catch { /* column already exists */ }
  try {
    getDb().exec(`ALTER TABLE sessions ADD COLUMN summary TEXT NOT NULL DEFAULT ''`)
  } catch { /* column already exists */ }
}

export function createSession(id: string, title: string, goal: string, context: object) {
  return getDb().prepare(
    'INSERT INTO sessions (id, title, goal, context) VALUES (?, ?, ?, ?)'
  ).run(id, title, goal, JSON.stringify(context))
}

export function getSession(id: string) {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined
}

export function updateSessionStatus(id: string, status: string) {
  return getDb().prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id)
}

export function saveSessionSummary(id: string, summary: string) {
  return getDb().prepare('UPDATE sessions SET summary = ? WHERE id = ?').run(summary, id)
}

export function updateSessionMode(id: string, mode: 'slide' | 'question') {
  return getDb().prepare('UPDATE sessions SET live_mode = ? WHERE id = ?').run(mode, id)
}

export function advanceStep(id: string, step: number) {
  return getDb().prepare('UPDATE sessions SET current_step = ? WHERE id = ?').run(step, id)
}

export function insertSteps(steps: StepInput[]) {
  const stmt = getDb().prepare(
    'INSERT INTO steps (id, session_id, step_order, type, title, content, is_question, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertMany = getDb().transaction((items: StepInput[]) => {
    for (const s of items) stmt.run(s.id, s.session_id, s.step_order, s.type, s.title, s.content, s.is_question ? 1 : 0, s.image_url || '')
  })
  insertMany(steps)
}

export function getSteps(session_id: string) {
  return getDb().prepare('SELECT * FROM steps WHERE session_id = ? ORDER BY step_order').all(session_id) as Step[]
}

export function addParticipant(id: string, session_id: string, name: string, role: string) {
  return getDb().prepare(
    'INSERT OR REPLACE INTO participants (id, session_id, name, role) VALUES (?, ?, ?, ?)'
  ).run(id, session_id, name, role)
}

export function getParticipants(session_id: string) {
  return getDb().prepare('SELECT * FROM participants WHERE session_id = ?').all(session_id) as Participant[]
}

export function addResponse(id: string, session_id: string, step_id: string, participant_name: string, participant_role: string, type: string, content: string) {
  return getDb().prepare(
    'INSERT INTO responses (id, session_id, step_id, participant_name, participant_role, type, content) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, session_id, step_id, participant_name, participant_role, type, content)
}

export function getResponses(session_id: string, step_id?: string) {
  if (step_id) {
    return getDb().prepare('SELECT * FROM responses WHERE session_id = ? AND step_id = ? ORDER BY created_at').all(session_id, step_id) as Response[]
  }
  return getDb().prepare('SELECT * FROM responses WHERE session_id = ? ORDER BY created_at').all(session_id) as Response[]
}

export interface Session {
  id: string; title: string; goal: string; context: string
  status: 'setup' | 'live' | 'ended'; live_mode: 'slide' | 'question'
  current_step: number; created_at: number; summary: string
}
export interface Step { id: string; session_id: string; step_order: number; type: string; title: string; content: string; is_question: number; image_url: string }
export interface StepInput { id: string; session_id: string; step_order: number; type: string; title: string; content: string; is_question: boolean; image_url?: string }
export interface Participant { id: string; session_id: string; name: string; role: string; joined_at: number }
export interface Response { id: string; session_id: string; step_id: string; participant_name: string; participant_role: string; type: string; content: string; created_at: number }
