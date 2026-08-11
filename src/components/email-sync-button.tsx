'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface SyncResult {
  received?: number
  sent?: number
  errors?: string[]
  error?: string
}

export function EmailSyncButton({ onSynced }: { onSynced?: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setResult(null)
    try {
      const res = await authedFetch('/api/email/sync', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      setResult(data)
      onSynced?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSyncing(false)
      setTimeout(() => {
        setResult(null)
        setError(null)
      }, 5000)
    }
  }

  const totalImported = (result?.received || 0) + (result?.sent || 0)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>

      {result && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>
            {totalImported > 0
              ? `${totalImported} new email${totalImported > 1 ? 's' : ''} imported`
              : 'No new emails'}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="max-w-xs truncate" title={error}>{error}</span>
        </div>
      )}
    </div>
  )
}
