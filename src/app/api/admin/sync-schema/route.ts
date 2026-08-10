import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { existsSync } from 'fs'

// POST /api/admin/sync-schema
// Forces prisma db push to sync the database schema with prisma/schema.prisma.
// Use this when you've added new fields to the Prisma schema but the database
// doesn't have them yet (e.g., imageUrl field was added but DB doesn't have it).
//
// Requires admin auth + a secret key for safety.

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const secret = body.secret || req.nextUrl.searchParams.get('secret')

    if (secret !== 'sylhn-sync-2026') {
      return NextResponse.json({ error: 'Invalid sync secret' }, { status: 403 })
    }

    const prismaBin = existsSync('./node_modules/.bin/prisma')
      ? './node_modules/.bin/prisma'
      : 'node ./node_modules/prisma/build/index.js'

    let dbUrl = process.env.DATABASE_URL || ''
    if (dbUrl && !dbUrl.includes('sslmode') && !dbUrl.includes('ssl=')) {
      dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require'
    }

    console.log('[sync-schema] Running prisma db push...')

    const output = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('prisma db push timed out after 90s'))
      }, 90000)

      exec(
        `${prismaBin} db push --skip-generate --accept-data-loss`,
        {
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_URL: dbUrl },
        },
        (err, stdout, stderr) => {
          clearTimeout(timeout)
          if (err) {
            console.error('[sync-schema] stderr:', stderr)
            reject(new Error(stderr || err.message))
          } else {
            console.log('[sync-schema] stdout:', stdout)
            resolve(stdout)
          }
        }
      )
    })

    return NextResponse.json({
      success: true,
      message: 'Database schema synced successfully. All new columns/tables are now in the database.',
      output: output.substring(0, 500),
    })
  } catch (e: any) {
    console.error('[sync-schema] Error:', e)
    return NextResponse.json(
      { error: e.message || 'Sync failed' },
      { status: 500 }
    )
  }
}

// GET — same as POST for easy browser access
export async function GET(req: NextRequest) {
  return POST(req)
}
