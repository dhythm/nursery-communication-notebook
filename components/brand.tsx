import { cn } from '@/lib/utils'

const arcs = [
  'oklch(0.7 0.13 40)',
  'oklch(0.82 0.13 75)',
  'oklch(0.67 0.13 158)',
  'oklch(0.65 0.11 240)',
]

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex items-end justify-center overflow-hidden rounded-2xl bg-secondary',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {arcs.map((c, i) => (
        <span
          key={c}
          className="absolute rounded-t-full"
          style={{
            borderTop: `${size * 0.11}px solid ${c}`,
            width: size * (0.72 - i * 0.16),
            height: size * (0.72 - i * 0.16),
            bottom: -size * (0.36 - i * 0.08),
          }}
        />
      ))}
      <span
        className="absolute rounded-full bg-card"
        style={{
          width: size * 0.16,
          height: size * 0.16,
          bottom: size * 0.12,
        }}
      />
    </span>
  )
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark size={36} />
      <span className="font-display text-xl font-bold tracking-tight">にじいろ連絡帳</span>
    </span>
  )
}
