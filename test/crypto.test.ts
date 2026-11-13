import { describe, expect, it } from 'vitest'

import { decrypt, encrypt, sha256Hex } from '../worker/crypto'

describe('token encryption', () => {
  it('round-trips and uses a fresh IV', async () => {
    const a = await encrypt('secret-1', 'ghp_token')
    const b = await encrypt('secret-1', 'ghp_token')
    expect(a).not.toBe(b)
    expect(await decrypt('secret-1', a)).toBe('ghp_token')
  })
  it('fails with the wrong secret', async () => {
    const a = await encrypt('secret-1', 'ghp_token')
    await expect(decrypt('secret-2', a)).rejects.toThrow()
  })
  it('hashes session ids', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
