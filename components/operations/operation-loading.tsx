import { LoaderCircle } from 'lucide-react'

export function OperationLoading({ label }: { label: string }) {
  return (
    <section
      role="status"
      aria-label={`${label}を準備しています`}
      className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <LoaderCircle
            aria-hidden="true"
            className="size-5 animate-spin motion-reduce:animate-none"
          />
        </span>
        <span aria-hidden="true" className="min-w-0 flex-1 space-y-2">
          <span className="block h-3 w-28 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <span className="block h-2.5 w-44 max-w-full animate-pulse rounded-full bg-muted/70 motion-reduce:animate-none" />
        </span>
      </div>
      <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <span
            key={item}
            className="h-16 animate-pulse rounded-2xl border border-border/60 bg-muted/45 motion-reduce:animate-none"
            style={{ animationDelay: `${item * 90}ms` }}
          />
        ))}
      </div>
    </section>
  )
}
