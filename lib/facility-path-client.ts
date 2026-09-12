'use client'

import { useParams } from 'next/navigation'
import { facilityScopedPath } from './facility-path'

export function useFacilityPath() {
  const { facilitySlug } = useParams<{ facilitySlug: string }>()
  return (path: string) => facilityScopedPath(facilitySlug, path)
}
