import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function GET() {
  try {
    const count = await db.email.count({
      where: {
        direction: 'received',
        status: 'received',
      }
    })
    return NextResponse.json({ count })
  } catch (e: any) {
    console.error('Unread count error:', e)
    return NextResponse.json({ count: 0, error: e.message })
  }
}
