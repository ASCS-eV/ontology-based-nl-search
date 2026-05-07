import { createFileRoute } from '@tanstack/react-router'

import { SearchPage } from '../components/SearchPage'

export const Route = createFileRoute('/')({
  component: SearchPage,
})
