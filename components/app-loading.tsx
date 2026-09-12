import { BookHeart } from 'lucide-react'

const dots = ['bg-primary', 'bg-chart-2', 'bg-chart-3']

export function AppLoading() {
  return (
    <div
      role="status"
      aria-label="連絡帳をひらいています"
      className="relative flex min-h-full items-center justify-center overflow-hidden bg-background px-6"
    >
      <div
        aria-hidden="true"
        className="absolute -left-16 top-1/4 size-52 rounded-full bg-secondary/70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 bottom-1/4 size-56 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-6 flex size-24 items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-spin rounded-[2rem] border-2 border-dashed border-primary/35 motion-reduce:animate-none"
            style={{ animationDuration: '8s' }}
          />
          <div className="flex size-16 items-center justify-center rounded-3xl border border-border bg-card text-primary shadow-lg shadow-primary/10">
            <BookHeart className="size-8" strokeWidth={1.8} />
          </div>
          <span
            aria-hidden="true"
            className="absolute right-0 top-1 size-3 animate-pulse rounded-full bg-chart-2 motion-reduce:animate-none"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-1 size-2.5 animate-pulse rounded-full bg-chart-3 motion-reduce:animate-none"
          />
        </div>

        <p className="font-display text-lg font-bold tracking-wide">連絡帳をひらいています</p>
        <div aria-hidden="true" className="mt-3 flex items-center gap-1.5">
          {dots.map((color, index) => (
            <span
              key={color}
              className={`size-2 animate-bounce rounded-full motion-reduce:animate-none ${color}`}
              style={{ animationDelay: `${index * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
