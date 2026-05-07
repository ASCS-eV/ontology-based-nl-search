export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/logos/funded-by-eu.svg"
              alt="Funded by the European Union"
              className="h-8 w-auto"
            />
            <a href="https://synergies-ccam.eu" target="_blank" rel="noopener noreferrer">
              <img src="/logos/synergies.svg" alt="SYNERGIES project" className="h-8 w-auto" />
            </a>
          </div>
          <p className="max-w-xl text-[10px] leading-tight text-gray-400 text-center sm:text-right">
            Funded by the European Union. Views and opinions expressed are those of the author(s)
            only and do not necessarily reflect those of the EU or CINEA. Neither the EU nor the
            granting authority can be held responsible for them.
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-xs text-gray-500">
              © {new Date().getFullYear()} Automotive Solution Center for Simulation e.V.
            </span>

            <nav className="flex items-center gap-4 text-xs text-gray-500">
              <a
                href="https://envited-x.net"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                ENVITED-X
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://synergies-ccam.eu"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                SYNERGIES
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://ascs.digital"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                ASCS e.V.
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://github.com/ASCS-eV/ontology-based-nl-search"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors"
              >
                GitHub
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
