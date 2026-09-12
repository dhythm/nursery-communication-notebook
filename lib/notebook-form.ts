import type { MealAmount, PickupPerson, StoolCondition } from './types'

export const stoolConditionLabels: Record<StoolCondition, string> = {
  none: 'なし',
  normal: '普通',
  soft: '軟らかめ',
  hard: '硬め',
  diarrhea: '下痢',
}

export const mealAmountLabels: Record<MealAmount, string> = {
  all: '完食',
  most: 'ほとんど',
  half: '半分くらい',
  little: '少し',
  none: '食べていない',
}

export const pickupPersonLabels: Record<PickupPerson, string> = {
  mother: '母',
  father: '父',
  grandparent: '祖父母',
  other: 'その他',
}

interface ParentNotebookValues {
  eveningMeal: string
  bedtime: string
  eveningStool: StoolCondition
  eveningStoolCount: number
  wakeTime: string
  morningStool: StoolCondition
  morningStoolCount: number
  breakfast: string
  breakfastAmount: MealAmount
  temperature: string
  pickupPerson: PickupPerson
  pickupPersonName: string
  pickupTime: string
}

export function validateParentNotebook(values: ParentNotebookValues): string | null {
  if (!values.eveningMeal.trim()) return '昨晩の夕食内容を入力してください。'
  if (!values.bedtime) return '昨晩の就寝時間を入力してください。'
  if (!values.wakeTime) return '今朝の起床時間を入力してください。'
  if (!values.breakfast.trim()) return '今朝の朝食内容を入力してください。'
  if (!values.temperature) return '今朝の体温を入力してください。'
  if (values.eveningStool === 'none' && values.eveningStoolCount !== 0)
    return '昨晩の排便回数を確認してください。'
  if (values.morningStool === 'none' && values.morningStoolCount !== 0)
    return '今朝の排便回数を確認してください。'
  if (values.pickupPerson === 'other' && !values.pickupPersonName.trim())
    return 'お迎えに来る方の名前を入力してください。'
  if (!values.pickupTime) return 'お迎え予定時刻を入力してください。'
  return null
}
