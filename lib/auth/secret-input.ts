export interface SecretInputState {
  value: string
  completed: boolean
  cancelled: boolean
}

export function consumeSecretInput(currentValue: string, input: string): SecretInputState {
  let value = currentValue
  for (const character of input) {
    if (character === '\u0003') return { value, completed: false, cancelled: true }
    if (character === '\r' || character === '\n') {
      return { value, completed: true, cancelled: false }
    }
    if (character === '\u007f') {
      value = value.slice(0, -1)
      continue
    }
    value += character
  }
  return { value, completed: false, cancelled: false }
}
