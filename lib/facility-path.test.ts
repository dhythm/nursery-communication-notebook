import { describe, expect, it } from 'vitest'
import { facilityApiPath, facilityPagePath } from './facility-path'

describe('facility paths', () => {
  it('builds canonical role and API paths from a public facility slug', () => {
    expect(facilityPagePath('nijiiro', 'parent')).toBe('/nurseries/nijiiro/parent')
    expect(facilityPagePath('nijiiro', 'teacher', '/children')).toBe(
      '/nurseries/nijiiro/teacher/children',
    )
    expect(facilityApiPath('nijiiro', '/notebook')).toBe('/api/nurseries/nijiiro/notebook')
    expect(facilityApiPath('nijiiro', '/files/file-1')).toBe('/api/nurseries/nijiiro/files/file-1')
  })

  it('rejects unsafe slugs and path traversal', () => {
    expect(() => facilityPagePath('../other', 'parent')).toThrow('InvalidFacilitySlug')
    expect(() => facilityApiPath('nijiiro', '/../other')).toThrow('InvalidFacilityPath')
  })
})
