import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React Testing Library leaves the DOM around between tests; clean it up so
// independent renders don't see each other's nodes.
afterEach(() => {
  cleanup()
})
