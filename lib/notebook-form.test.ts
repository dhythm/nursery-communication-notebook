import { describe, expect, it } from 'vitest'
import { validateParentNotebook } from './notebook-form'

const completeEntry = {
  eveningMeal: 'ご飯、焼き魚、みそ汁',
  bedtime: '21:00',
  eveningStool: 'normal' as const,
  eveningStoolCount: 1,
  wakeTime: '06:30',
  morningStool: 'none' as const,
  morningStoolCount: 0,
  breakfast: 'トースト、バナナ、牛乳',
  temperature: '36.5',
  temperatureMeasuredAt: '07:00',
  pickupPerson: 'mother' as const,
  pickupPersonName: '',
  pickupTime: '17:30',
}

describe('validateParentNotebook', () => {
  it('accepts a complete structured entry', () => {
    expect(validateParentNotebook(completeEntry)).toBeNull()
  })

  it('reports the first missing required field', () => {
    expect(validateParentNotebook({ ...completeEntry, bedtime: '' })).toBe(
      '前夜の就寝時間を入力してください。',
    )
  })

  it('requires the time at which temperature was measured', () => {
    expect(validateParentNotebook({ ...completeEntry, temperatureMeasuredAt: '' })).toBe(
      '体温を測った時間を入力してください。',
    )
  })

  it('requires a name when another pickup person is selected', () => {
    expect(
      validateParentNotebook({
        ...completeEntry,
        pickupPerson: 'other',
        pickupPersonName: '',
      }),
    ).toBe('お迎えに来る方の名前を入力してください。')
  })

  it('rejects an inconsistent stool count', () => {
    expect(
      validateParentNotebook({
        ...completeEntry,
        morningStool: 'none',
        morningStoolCount: 1,
      }),
    ).toBe('当日朝の排便回数を確認してください。')
  })
})
