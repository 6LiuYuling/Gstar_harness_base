import { describe, expect, it, vi } from 'vitest'
import { enableInheritedHttpProxy } from '../src/network-bootstrap.ts'

describe('enableInheritedHttpProxy', () => {
  it('applies inherited HTTP proxy variables through the Node runtime', () => {
    const setGlobalProxyFromEnv = vi.fn()
    const environment = { HTTPS_PROXY: 'http://proxy.example:8080', NO_PROXY: 'localhost' }

    expect(enableInheritedHttpProxy(environment, { setGlobalProxyFromEnv })).toBe(true)
    expect(setGlobalProxyFromEnv).toHaveBeenCalledWith(environment)
  })

  it('does not replace the global dispatcher without an inherited proxy', () => {
    const setGlobalProxyFromEnv = vi.fn()

    expect(enableInheritedHttpProxy({ NO_PROXY: 'localhost' }, { setGlobalProxyFromEnv })).toBe(false)
    expect(setGlobalProxyFromEnv).not.toHaveBeenCalled()
  })

  it('reports the Node compatibility switch when dynamic support is unavailable', () => {
    const warn = vi.fn()

    expect(enableInheritedHttpProxy({ HTTP_PROXY: 'http://proxy.example' }, {}, warn)).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NODE_USE_ENV_PROXY=1'))
  })
})
