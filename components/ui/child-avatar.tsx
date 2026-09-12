import { cn } from '@/lib/utils'

interface ChildAvatarProps {
  name: string
  color: string
  size?: number
  className?: string
}

export function ChildAvatar({ name, color, size = 44, className }: ChildAvatarProps) {
  const initial = name.replace(/\s/g, '').slice(-2, -1) || name.slice(0, 1)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </span>
  )
}
