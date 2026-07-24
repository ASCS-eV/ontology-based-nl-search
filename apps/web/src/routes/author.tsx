import { createFileRoute } from '@tanstack/react-router'

import { AuthoringPage } from '../components/AuthoringPage'

export const Route = createFileRoute('/author')({
  component: AuthoringPage,
})
