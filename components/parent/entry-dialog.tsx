'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { moodConfig } from '@/lib/format'
import {
  pickupPersonLabels,
  stoolConditionLabels,
  validateParentNotebook,
} from '@/lib/notebook-form'
import { useStore } from '@/lib/store'
import type { Child, Mood, NotebookEntry, PickupPerson, StoolCondition } from '@/lib/types'
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
  const { saveNotebookEntry, updateNotebookEntry } = useStore()
  const [mood, setMood] = useState<Mood>(entry?.mood ?? 'good')
  const [temperature, setTemperature] = useState(entry?.temperature ?? '36.5')
  const [eveningMeal, setEveningMeal] = useState(entry?.eveningMeal ?? '')
  const [bedtime, setBedtime] = useState(entry?.bedtime ?? '')
  const [eveningStool, setEveningStool] = useState<StoolCondition>(entry?.eveningStool ?? 'none')
  const [eveningStoolCount, setEveningStoolCount] = useState(entry?.eveningStoolCount ?? 0)
  const [wakeTime, setWakeTime] = useState(entry?.wakeTime ?? '')
  const [morningStool, setMorningStool] = useState<StoolCondition>(entry?.morningStool ?? 'none')
  const [morningStoolCount, setMorningStoolCount] = useState(entry?.morningStoolCount ?? 0)
  const [breakfast, setBreakfast] = useState(entry?.breakfast ?? '')
  const [temperatureMeasuredAt, setTemperatureMeasuredAt] = useState(
    entry?.temperatureMeasuredAt ?? '',
  )
  const [condition, setCondition] = useState(entry?.condition ?? '')
  const [pickupPerson, setPickupPerson] = useState<PickupPerson>(entry?.pickupPerson ?? 'mother')
  const [pickupPersonName, setPickupPersonName] = useState(entry?.pickupPersonName ?? '')
  const [pickupTime, setPickupTime] = useState(entry?.pickupTime ?? '')
  const [note, setNote] = useState(entry?.note ?? '')

  function reset() {
    setMood('good')
    setTemperature('36.5')
    setEveningMeal('')
    setBedtime('')
    setEveningStool('none')
    setEveningStoolCount(0)
    setWakeTime('')
    setMorningStool('none')
    setMorningStoolCount(0)
    setBreakfast('')
    setTemperatureMeasuredAt('')
    setCondition('')
    setPickupPerson('mother')
    setPickupPersonName('')
    setPickupTime('')
    setNote('')
  }

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(status: 'draft' | 'published') {
    if (isSaving) return
    const structuredValues = {
      eveningMeal,
      bedtime,
      eveningStool,
      eveningStoolCount,
      wakeTime,
      morningStool,
      morningStoolCount,
      breakfast,
      temperature,
      temperatureMeasuredAt,
      pickupPerson,
      pickupPersonName,
      pickupTime,
    }
    if (status === 'published') {
      const validationError = validateParentNotebook(structuredValues)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        childId: child.id,
        mood,
        meals: breakfast || '記入なし',
        nap: bedtime && wakeTime ? `${bedtime}〜${wakeTime}` : '記入なし',
        toilet: `昨晩 ${stoolConditionLabels[eveningStool]} ${eveningStoolCount}回・今朝 ${stoolConditionLabels[morningStool]} ${morningStoolCount}回`,
        note: note || '',
        ...structuredValues,
        condition,
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
      <div className="space-y-6">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <section className="space-y-4">
          <h3 className="border-b border-border pb-2 font-bold">昨晩の様子</h3>
          <Field label="夕食内容">
            <Textarea
              value={eveningMeal}
              onChange={(event) => setEveningMeal(event.target.value)}
              placeholder="例）ご飯、焼き魚、みそ汁"
              className="min-h-16"
            />
          </Field>
          <StoolFields
            label="昨晩の排便"
            condition={eveningStool}
            count={eveningStoolCount}
            onConditionChange={setEveningStool}
            onCountChange={setEveningStoolCount}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="就寝時間">
              <Input
                type="time"
                value={bedtime}
                onChange={(event) => setBedtime(event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="border-b border-border pb-2 font-bold">今朝の様子</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="起床時間">
              <Input
                type="time"
                value={wakeTime}
                onChange={(event) => setWakeTime(event.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="体温">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="34"
                  max="42"
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                />
                <span className="text-sm text-muted-foreground">℃</span>
              </div>
            </Field>
            <Field label="検温時刻">
              <Input
                type="time"
                value={temperatureMeasuredAt}
                onChange={(event) => setTemperatureMeasuredAt(event.target.value)}
              />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">きげん・体調</p>
            <div className="grid grid-cols-3 gap-2">
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
          <StoolFields
            label="今朝の排便"
            condition={morningStool}
            count={morningStoolCount}
            onConditionChange={setMorningStool}
            onCountChange={setMorningStoolCount}
          />
          <Field label="朝食内容">
            <Textarea
              value={breakfast}
              onChange={(event) => setBreakfast(event.target.value)}
              placeholder="例）トースト、バナナ、牛乳"
              className="min-h-16"
            />
          </Field>
          <Field label="子どもの様子">
            <Textarea
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              placeholder="例）少し鼻水がありますが、元気に過ごしています"
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h3 className="border-b border-border pb-2 font-bold">お迎え予定・連絡</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="お迎えに来る方">
              <ChoiceSelect
                value={pickupPerson}
                options={pickupPersonLabels}
                onChange={(value) => setPickupPerson(value as PickupPerson)}
              />
            </Field>
            <Field label="お迎え予定時刻">
              <Input
                type="time"
                value={pickupTime}
                onChange={(event) => setPickupTime(event.target.value)}
              />
            </Field>
          </div>
          {pickupPerson === 'other' && (
            <Field label="お迎えに来る方の名前">
              <Input
                value={pickupPersonName}
                onChange={(event) => setPickupPersonName(event.target.value)}
              />
            </Field>
          )}
          <Field label="連絡事項">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="先生への連絡事項があればご記入ください"
            />
          </Field>
        </section>
      </div>
    </Modal>
  )
}

function StoolFields({
  label,
  condition,
  count,
  onConditionChange,
  onCountChange,
}: {
  label: string
  condition: StoolCondition
  count: number
  onConditionChange: (value: StoolCondition) => void
  onCountChange: (value: number) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <div className="grid grid-cols-[1fr_4.5rem] gap-2">
        <ChoiceSelect
          label={`${label}の状態`}
          value={condition}
          options={stoolConditionLabels}
          onChange={(value) => {
            const next = value as StoolCondition
            onConditionChange(next)
            if (next === 'none') onCountChange(0)
            else if (count === 0) onCountChange(1)
          }}
        />
        <label>
          <span className="sr-only">{label}の回数</span>
          <Select
            value={count}
            onChange={(event) => onCountChange(Number(event.target.value))}
            className="px-2 text-sm"
          >
            {Array.from({ length: 11 }, (_, value) => (
              <option key={value} value={value}>
                {value}回
              </option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  )
}

function ChoiceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: string
  options: Record<string, string>
  onChange: (value: string) => void
}) {
  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {Object.entries(options).map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </Select>
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
