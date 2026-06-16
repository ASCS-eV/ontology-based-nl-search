import type { DesignSystem } from '../../registry'
import { envitedBrand } from './brand'
import { Alert, Button, Card, Heading, Pill, Spinner } from './components'

/** The default, bundled ENVITED-X design system. */
export const envitedDesignSystem: DesignSystem = {
  brand: envitedBrand,
  components: { Button, Pill, Card, Alert, Spinner, Heading },
}
