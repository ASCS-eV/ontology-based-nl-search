import { useDesignSystem } from '@ontology-search/design-system'
import { Fragment } from 'react'

export function Footer() {
  const { brand } = useDesignSystem()
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            {brand.footerLogos.map((logo) =>
              logo.href ? (
                <a key={logo.src} href={logo.href} target="_blank" rel="noopener noreferrer">
                  <img src={logo.src} alt={logo.alt} className="h-8 w-auto" />
                </a>
              ) : (
                <img key={logo.src} src={logo.src} alt={logo.alt} className="h-8 w-auto" />
              )
            )}
          </div>
          {brand.disclaimer && (
            <p className="max-w-xl text-[10px] leading-tight text-gray-400 text-center sm:text-right">
              {brand.disclaimer}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-xs text-gray-500">{brand.copyright}</span>

            <nav className="flex items-center gap-4 text-xs text-gray-500">
              {brand.links.map((link, i) => (
                <Fragment key={link.href}>
                  {i > 0 && <span className="text-gray-300">|</span>}
                  <a
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {link.label}
                  </a>
                </Fragment>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
