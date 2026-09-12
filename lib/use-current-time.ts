'use client'

import { useEffect, useState } from 'react'

export function useCurrentTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function refresh() {
      clearTimeout(timer)
      setNow(new Date())
      timer = setTimeout(refresh, 60_000 - (Date.now() % 60_000))
    }
    timer = setTimeout(refresh, 60_000 - (Date.now() % 60_000))
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return now
}
