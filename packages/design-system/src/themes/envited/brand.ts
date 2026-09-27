import type { BrandConfig } from '../../registry'

/**
 * ENVITED-X branding — mirrors the app's current identity (logos already in
 * `apps/web/public/logos`, links and copyright from the original Header/Footer).
 * This is the default, bundled brand.
 */
export const envitedBrand: BrandConfig = {
  id: 'envited-x',
  name: 'ENVITED-X',
  appTitle: 'ENVITED-X Simulation Asset Search',
  appTagline: 'Ontology NL Search',
  theme: 'envited-x',
  headerLogo: { src: '/logos/envited-x-colour.png', alt: 'ENVITED-X' },
  footerLogos: [
    { src: '/logos/funded-by-eu.png', alt: 'Funded by the European Union' },
    { src: '/logos/synergies.svg', alt: 'SYNERGIES project', href: 'https://synergies-ccam.eu' },
  ],
  links: [
    { label: 'ENVITED-X', href: 'https://envited-x.net', external: true },
    { label: 'SYNERGIES', href: 'https://synergies-ccam.eu', external: true },
    { label: 'ASCS e.V.', href: 'https://ascs.digital', external: true },
    {
      label: 'GitHub',
      href: 'https://github.com/ASCS-eV/ontology-based-nl-search',
      external: true,
    },
  ],
  copyright: `© ${new Date().getFullYear()} Automotive Solution Center for Simulation e.V.`,
  // The funding statement as the SYNERGIES project publishes it; the emblem is
  // the Commission's official "Funded by the European Union" artwork.
  disclaimer:
    'Funded by the European Union. Views and opinions expressed are however those of the ' +
    'author(s) only and do not necessarily reflect those of the European Union or the European ' +
    'Climate, Infrastructure and Environment Executive Agency (CINEA). Neither the European ' +
    'Union nor CINEA can be held responsible for them.',
}
