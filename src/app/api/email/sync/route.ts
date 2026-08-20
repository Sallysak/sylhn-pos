// src/app/api/email/sync/route.ts
// IMAP sync — fetches new emails from Gmail into POS.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Imap from 'imap'
import { simpleParser } from 'mailparser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function syncFolder(imap: Imap, folder: string, isReceived: boolean) {
  return new Promise<{ imported: number }>((resolve, reject) => {
    imap.openBox(folder, false, (err) => {
      if (err) return reject(err)

      imap.search(['UNSEEN'], (err, uids) => {
        if (err) return reject(err)
        if (!uids || uids.length === 0) return resolve({ imported: 0 })

        const f = imap.fetch(uids, { bodies: '', markSeen: true })
        const messages: any[] = []

        f.on('message', (msg) => {
          msg.on('body', (stream) => {
            let buf = ''
            stream.on('data', (c) => (buf += c.toString('utf8')))
            stream.on('end', async () => {
              try {
                const parsed = await simpleParser(buf)
                messages.push(parsed)
              } catch (e: any) {
                console.error('parse error', e)
              }
            })
          })
        })

        f.once('error', reject)
        f.once('end', async () => {
          let imported = 0
          for (const msg of messages) {
            const messageId = msg.messageId || null
            if (messageId) {
              const exists = await db.email.findFirst({ where: { messageId: messageId as any } }).catch(() => null)
              if (exists) continue
            }

            try {
              await db.email.create({
                data: {
                  fromAddress: msg.from?.text || '',
                  toAddress: msg.to?.text || '',
                  subject: msg.subject || '(no subject)',
                  body: msg.text || msg.html || '',
                  status: isReceived ? 'received' : 'sent',
                  attachments: { _sync: { messageId, direction: isReceived ? 'received' : 'sent' } } as any,
                },
              })
              imported++
            } catch (e: any) {
              console.error('save error', e)
              try {
                await db.email.create({
                  data: {
                    fromAddress: msg.from?.text || '',
                    toAddress: msg.to?.text || '',
                    subject: msg.subject || '(no subject)',
                    body: msg.text || msg.html || '',
                    status: isReceived ? 'received' : 'sent',
                  },
                })
                imported++
              } catch (e2) {
                console.error('save error (minimal)', e2)
              }
            }
          }
          resolve({ imported })
        })
      })
    })
  })
}

async function runSync() {
  const user = process.env.IMAP_USER
  const password = process.env.IMAP_PASSWORD
  if (!user || !password) {
    return { error: 'IMAP_USER or IMAP_PASSWORD env var not set' }
  }

  return new Promise((resolve) => {
    const imap = new Imap({
      user,
      password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 20000,
      authTimeout: 15000,
    })

    const result: any = { received: 0, sent: 0, errors: [] }

    imap.once('ready', async () => {
      try {
        const r = await syncFolder(imap, 'INBOX', true)
        result.received = r.imported
      } catch (e: any) {
        result.errors.push('INBOX: ' + e.message)
      }

      try {
        const s = await syncFolder(imap, '[Gmail]/Sent Mail', true)
        result.sent = s.imported
      } catch (e: any) {
        try {
          const s = await syncFolder(imap, 'Sent', true)
          result.sent = s.imported
        } catch (e2: any) {
          result.errors.push('Sent: ' + e2.message)
        }
      }

      imap.end()
      resolve(result)
    })

    imap.once('error', (err: any) => {
      resolve({ error: err.message })
    })

    imap.connect()
  })
}

export async function POST() {
  const result = await runSync()
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runSync()
  return NextResponse.json(result)
}
