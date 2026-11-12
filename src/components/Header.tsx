import { ThemeToggle } from './ThemeToggle'

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-header backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <span className="font-serif text-2xl font-semibold text-navy">
          Locus<span className="text-teal" aria-hidden="true">.</span>
        </span>
        <ThemeToggle />
      </div>
    </header>
  )
}
