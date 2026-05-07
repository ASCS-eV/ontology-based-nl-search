import Image from 'next/image'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      {/* Acknowledgements */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 mb-4">
            This tool is developed as part of the{' '}
            <a
              href="https://synergies-ccam.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue hover:underline"
            >
              SYNERGIES project
            </a>
            .
          </p>

          <div className="flex items-center justify-center gap-8 mb-6">
            <a
              href="https://synergies-ccam.eu"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/logos/synergies.svg"
                alt="SYNERGIES - Real and synthetic scenarios for CCAM systems"
                width={200}
                height={60}
                className="h-14 w-auto"
              />
            </a>
          </div>

          <p className="mx-auto max-w-2xl text-xs text-gray-500 mb-6">
            Funded by the European Union. Views and opinions expressed are
            however those of the author(s) only and do not necessarily reflect
            those of the European Union or European Climate, Infrastructure and
            Environment Executive Agency (CINEA). Neither the European Union nor
            the granting authority can be held responsible for them.
          </p>

          <div className="flex items-center justify-center gap-8">
            <Image
              src="/logos/funded-by-eu.svg"
              alt="Funded by the European Union"
              width={200}
              height={50}
              className="h-12 w-auto"
            />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-4">
              <Image
                src="/logos/ascs-2020.png"
                alt="ASCS e.V."
                width={80}
                height={30}
                className="h-7 w-auto"
              />
              <span className="text-xs text-gray-500">
                © {new Date().getFullYear()} Automotive Solution Center for
                Simulation e.V.
              </span>
            </div>

            <nav className="flex items-center gap-4 text-xs text-gray-500">
              <a
                href="https://envited-x.net"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue transition-colors"
              >
                ENVITED-X
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://synergies-ccam.eu"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue transition-colors"
              >
                SYNERGIES
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://ascs-ev.de"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue transition-colors"
              >
                ASCS e.V.
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="https://github.com/ASCS-eV/ontology-based-nl-search"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue transition-colors"
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
