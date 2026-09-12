import type { Role } from './types'

const facilitySlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function assertFacilitySlug(slug: string) {
  if (!facilitySlugPattern.test(slug)) throw new Error('InvalidFacilitySlug')
  return slug
}

function assertSuffix(suffix: string) {
  if (suffix !== '' && (!suffix.startsWith('/') || suffix.includes('..') || suffix.includes('//')))
    throw new Error('InvalidFacilityPath')
  return suffix
}

export function facilityPagePath(slug: string, role: Role, suffix = '') {
  return `/nurseries/${assertFacilitySlug(slug)}/${role}${assertSuffix(suffix)}`
}

export function facilityScopedPath(slug: string, path: string) {
  if (!/^\/(parent|teacher)(?:\/|$)/.test(path)) throw new Error('InvalidFacilityPath')
  return `/nurseries/${assertFacilitySlug(slug)}${assertSuffix(path)}`
}

export function facilityApiPath(slug: string, suffix: string) {
  return `/api/nurseries/${assertFacilitySlug(slug)}${assertSuffix(suffix)}`
}
