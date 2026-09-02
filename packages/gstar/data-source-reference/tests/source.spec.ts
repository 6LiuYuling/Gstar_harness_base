import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

const CONFIG = {
  id: 'official-enterprise',
  name: '企业权威参考',
  publisher: '国家机构',
  url: 'https://example.gov.cn/enterprise',
  categories: ['企'] as ['企'],
  defaultEnabled: false,
}

describe('gstar-data-source-reference', () => {
  it('registers configured metadata without an executable acquisition operation', () => {
    const dispose = vi.fn()
    const register = vi.fn().mockReturnValue(dispose)
    expect(apply({ gstarDataSources: { register } } as never, CONFIG)).toBe(dispose)
    expect(register).toHaveBeenCalledWith({
      descriptor: expect.objectContaining({
        id: CONFIG.id,
        name: CONFIG.name,
        url: CONFIG.url,
        accessMode: 'reference',
        capabilities: ['verification'],
        defaultEnabled: false,
      }),
    })
  })

  it('rejects non-HTTP platform URLs', () => {
    expect(() => apply({ gstarDataSources: { register: vi.fn() } } as never, {
      ...CONFIG,
      url: 'file:///private/catalog.json',
    })).toThrow('must use http or https')
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const dispose = await invariant.apply({ invariants: { register } } as never)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-data-source-reference', expect.any(Function))
    expect(dispose).toBeTypeOf('function')
  })
})
