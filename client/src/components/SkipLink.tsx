import { useT } from '@/lib/useT'
import { skipLinkT } from '@/lib/texte/komponenten/SkipLink'

export function SkipLink() {
  const tt = useT()
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
    >
      {tt(skipLinkT.hauptinhalt)}
    </a>
  )
}
