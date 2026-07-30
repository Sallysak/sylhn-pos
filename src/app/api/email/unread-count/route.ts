import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const count = await prisma.email.count({
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
