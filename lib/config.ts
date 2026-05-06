import fs from 'fs'
import path from 'path'

function readEnvFile(): Record<string, string> {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const content = fs.readFileSync(envPath, 'utf-8').replace(/^﻿/, '')
    const result: Record<string, string> = {}
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim()
        const value = trimmed.slice(eqIndex + 1).trim()
        result[key] = value
      }
    }
    return result
  } catch { return {} }
}

const envVars = readEnvFile()
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || envVars['ANTHROPIC_API_KEY'] || ''
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || envVars['OPENAI_API_KEY'] || ''
