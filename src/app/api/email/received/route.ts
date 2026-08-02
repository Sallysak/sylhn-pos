import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10)
    
    const emails = await prisma.email.findMany({
      where: { direction: 'received' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      emails: emails.map(e => ({
        id: e.id,
        from: e.fromAddress,
        to: e.toAddress,
        subject: e.subject,
        body: e.body,
        status: 'received',
        direction: 'received',
        createdAt: e.createdAt.toISOString(),
      }))
    })
  } catch (e: any) {
    console.error('Fetch received emails error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to fetch received emails' },
      { status: 500 }
    )
  }
}
