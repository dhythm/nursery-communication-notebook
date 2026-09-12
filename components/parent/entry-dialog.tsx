'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { moodConfig } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Child, Mood, NotebookEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

const moods = Object.keys(moodConfig) as Mood[]

export function EntryDialog({
  open,
  onClose,
  child,
  entry,
}: {
  open: boolean
  onClose: () => void
  child: Child
  entry?: NotebookEntry
}) {
  const { saveNotebookEntry, updateNotebookEntry, uploadFile } = useStore()
  const [mood, setMood] = useState<Mood>(entry?.mood ?? 'genki')
  const [temperature, setTemperature] = useState(entry?.temperature ?? '36.5')
  const [meals, setMeals] = useState(entry?.meals ?? '')
  const [nap, setNap] = useState(entry?.nap ?? '')
  const [toilet, setToilet] = useState(entry?.toilet ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  function reset() {
    setMood('genki')
    setTemperature('36.5')
    setMeals('')
    setNap('')
    setToilet('')
    setNote('')
  }

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(status: 'draft' | 'published') {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const photo = photoFile
        ? await uploadFile(photoFile, `${child.name}の連絡帳写真`, undefined, 'notebook', child.id)
        : entry?.photo
      const payload = {
        childId: child.id,
        mood,
        temperature,
        meals: meals || '記入なし',
        nap: nap || '記入なし',
        toilet: toilet || '記入なし',
        note: note || '',
        ...(photo ? { photo } : {}),
        status,
      } as const
      if (entry) {
        const patch: Partial<NotebookEntry> = { ...payload }
        delete patch.childId
        await updateNotebookEntry(entry.id, entry.version ?? 1, patch)
      } else await saveNotebookEntry(payload)
      reset()
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存できませんでした')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${child.name.split(' ')[1] ?? child.name} の様子を${entry ? '編集' : '登録'}`}
      description="ご家庭での様子を先生に伝えましょう"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-2xl"
            onClick={() => void submit('draft')}
            disabled={isSaving}
          >
            下書き保存
          </Button>
          <Button
            className="h-11 flex-[2] rounded-2xl font-bold"
            onClick={() => void submit('published')}
            disabled={isSaving}
          >
            この内容で送信
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div>
          <p className="mb-2 text-sm font-semibold">きげん・体調</p>
          <div className="grid grid-cols-4 gap-2">
            {moods.map((m) => {
              const cfg = moodConfig[m]
              const active = mood === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-transparent text-white'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                  style={active ? { backgroundColor: cfg.color } : undefined}
                >
                  <span className="text-lg leading-none">{cfg.emoji}</span>
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="体温">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.1"
              min="34"
              max="42"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">℃</span>
          </div>
        </Field>

        <Field label="朝ごはん・食事">
          <Textarea
            value={meals}
            onChange={(e) => setMeals(e.target.value)}
            placeholder="例）パンとバナナを食べました"
            className="min-h-16"
          />
        </Field>

        <Field label="睡眠">
          <Input
            value={nap}
            onChange={(e) => setNap(e.target.value)}
            placeholder="例）21:00〜6:30"
          />
        </Field>

        <Field label="排便">
          <Input
            value={toilet}
            onChange={(e) => setToilet(e.target.value)}
            placeholder="例）朝は快便でした"
          />
        </Field>

        <Field label="連絡・伝えたいこと">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="先生への連絡事項があればご記入ください"
          />
        </Field>
        <Field label="写真">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  )
}
