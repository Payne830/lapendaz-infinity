import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'tunnel-url.json')
    if (!fs.existsSync(filePath)) return NextResponse.json({ url: '' })
    const content = fs.readFileSync(filePath, 'utf-8')
    const { url } = JSON.parse(content)
    return NextResponse.json({ url: url || '' })
  } catch {
    return NextResponse.json({ url: '' })
  }
}
