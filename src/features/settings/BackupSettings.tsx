import { DatabaseBackup, Download, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../../components/common/Button'
import { Card, CardHeader } from '../../components/common/Card'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Note } from '../../components/common/StateViews'
import { readAll } from '../../data/db'
import { mergeBackup, replaceWithBackup } from '../../data/repo'
import { createBackup, parseBackup, type BackupFile } from '../../domain/backup'
import { todayISO } from '../../domain/dates'
import { downloadText } from '../../utils/download'
import { writeStorage } from '../../utils/storage'

export const LAST_BACKUP_KEY = 'last-backup'

async function exportBackup(suffix = ''): Promise<number> {
  const data = await readAll()
  const backup = createBackup(data)
  downloadText(`money-tracker-backup-${todayISO()}${suffix}.json`, JSON.stringify(backup, null, 2), 'application/json')
  writeStorage(LAST_BACKUP_KEY, new Date().toISOString())
  return data.transactions.length
}

export function BackupSettings({ lastBackup, onBackedUp }: { lastBackup: string | null; onBackedUp: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [incoming, setIncoming] = useState<BackupFile | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace' | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setMessage(null)
    setIncoming(result.backup)
  }

  async function restore() {
    if (!incoming || !mode) return
    setBusy(true)
    try {
      if (mode === 'merge') {
        const r = await mergeBackup(incoming.data)
        setMessage({ tone: 'ok', text: `Restored: ${String(r.added)} records added, ${String(r.skipped)} already present and kept as they are.` })
      } else {
        // Safety copy of what is about to be replaced.
        await exportBackup('-before-restore')
        await replaceWithBackup(incoming.data)
        setMessage({ tone: 'ok', text: 'All data replaced from the backup. A copy of the previous data was downloaded first.' })
      }
    } catch (err) {
      setMessage({ tone: 'error', text: `Restore failed and nothing was changed: ${err instanceof Error ? err.message : 'unknown error'}` })
    } finally {
      setBusy(false)
      setIncoming(null)
      setMode(null)
    }
  }

  const counts = incoming
    ? `${String(incoming.data.transactions.length)} transactions, ${String(incoming.data.cards.length)} cards, ${String(incoming.data.people.length)} people`
    : ''

  return (
    <Card aria-labelledby="backup-heading">
      <CardHeader
        id="backup-heading"
        icon={<DatabaseBackup />}
        title="Backup & restore"
        description={lastBackup ? `Last backup downloaded ${new Date(lastBackup).toLocaleDateString('en-IN')}` : 'No backup downloaded from this device yet.'}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          icon={<Download />}
          onClick={() => {
            void exportBackup().then((n) => {
              onBackedUp()
              setMessage({ tone: 'ok', text: `Backup downloaded (${String(n)} transactions). Keep it somewhere safe, e.g. Google Drive.` })
            })
          }}
        >
          Download backup (JSON)
        </Button>
        <Button variant="secondary" icon={<Upload />} onClick={() => { fileRef.current?.click() }}>
          Restore from backup
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e)} />
      </div>
      {message && (
        <p role="status" className={message.tone === 'ok' ? 'mt-3 text-sm text-success' : 'mt-3 text-sm font-medium text-danger'}>
          {message.text}
        </p>
      )}
      <div className="mt-3">
        <Note>
          Your data is stored only in this browser on this device. It is <strong>not</strong> synced to your other devices or the
          cloud. Download a backup regularly; to move to another phone, restore the backup file there.
        </Note>
      </div>

      <ConfirmDialog
        open={incoming !== null && mode === null}
        title="Restore this backup?"
        confirmLabel="Add missing records"
        onCancel={() => { setIncoming(null) }}
        onConfirm={() => { setMode('merge') }}
      >
        <p>The file contains {counts}.</p>
        <p>
          <strong>Add missing records</strong> keeps everything you have and only adds entries that aren’t here yet — restoring the
          same file twice never creates duplicates.
        </p>
        <p>
          To replace all current data instead,{' '}
          <button type="button" className="font-semibold text-danger underline" onClick={() => { setMode('replace') }}>
            replace everything
          </button>
          .
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={incoming !== null && mode !== null}
        title={mode === 'replace' ? 'Replace ALL current data?' : 'Add missing records?'}
        confirmLabel={mode === 'replace' ? 'Replace everything' : 'Restore'}
        destructive={mode === 'replace'}
        busy={busy}
        onCancel={() => {
          setMode(null)
          setIncoming(null)
        }}
        onConfirm={() => void restore()}
      >
        {mode === 'replace' ? (
          <p>
            Every card, person and transaction on this device will be replaced by the {counts} in the file. A backup of your current
            data will be downloaded first.
          </p>
        ) : (
          <p>Records from the file ({counts}) that aren’t already here will be added. Nothing existing is changed.</p>
        )}
      </ConfirmDialog>
    </Card>
  )
}
