import { vi } from 'vitest'

/** Mongoose-style query chain mock: .select().sort().lean() → resolved value */
export const mockFindChain = (result = []) => {
  const lean = vi.fn().mockResolvedValue(result)
  const sort = vi.fn().mockReturnValue({ lean })
  const select = vi.fn().mockReturnValue({ sort, lean })
  const find = vi.fn().mockReturnValue({ select })
  return { find, select, sort, lean }
}
