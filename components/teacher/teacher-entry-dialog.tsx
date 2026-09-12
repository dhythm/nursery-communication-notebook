'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { moodConfig } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Child, Mood } from '@/lib/types'
import { cn } from '@/lib/utils'

const moods = Object.keys(moodConfig) as Mood[]

export function TeacherEntryDialog({
  open,
  onClose,
  child,
}: {
  open: boolean
  onClose: () => void
  child: Child
}) {
  const { addNotebookEntry } = useStore()
  const [mood, setMood] = useState<Mood>('genki')
  const [temperature, setTemperature] = useState('36.5')
  const [meals, setMeals] = useState('')
  const [nap, setNap] = useState('')
  const [toilet, setToilet] = useState('')
  const [note, setNote] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await addNotebookEntry({
        childId: child.id,
        mood,
        temperature,
        meals: meals || '記入なし',
        nap: nap || '記入なし',
        toilet: toilet || '記入なし',
        note,
      })
      setMood('genki')
      setTemperature('36.5')
      setMeals('')
      setNap('')
      setToilet('')
      setNote('')
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
      title={`${child.name} の連絡帳を記入`}
      description="園でのお子さまの様子を保護者へお伝えします"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            className="h-11 flex-[2] rounded-2xl font-bold"
            onClick={submit}
            disabled={isSaving}
          >
            保護者へ送信
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
          <p className="mb-2 text-sm font-semibold">今日のごきげん・体調</p>
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

        <Field label="給食・おやつ">
          <Textarea
            value={meals}
            onChange={(e) => setMeals(e.target.value)}
            placeholder="例）給食は完食しました。おかわりもしています。"
            className="min-h-16"
          />
        </Field>

        <Field label="午睡">
          <Input
            value={nap}
            onChange={(e) => setNap(e.target.value)}
            placeholder="例）12:40〜14:30"
          />
        </Field>

        <Field label="排せつ">
          <Input
            value={toilet}
            onChange={(e) => setToilet(e.target.value)}
            placeholder="例）午前2回・午後1回"
          />
        </Field>

        <Field label="今日のようす・連絡事項">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="園での過ごし方や気づいたことをご記入ください"
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
