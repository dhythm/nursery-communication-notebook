import { cn } from '@/lib/utils'

function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        'bg-secondary text-secondary-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
