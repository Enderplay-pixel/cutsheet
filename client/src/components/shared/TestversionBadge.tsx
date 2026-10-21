import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { testversionT } from '@/lib/texte/komponenten/Shared'

/**
 * Kennzeichnet eine Testversion (Server mit CUTSHEET_TESTVERSION=1), damit
 * niemand echte Produktionsdaten in eine Umgebung tippt, die vor dem Launch
 * noch zurueckgesetzt werden kann.
 */
export function useTestversion() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<{ testversion?: boolean }> => {
      const r = await fetch('/api/health')
      return r.ok ? r.json() : {}
    },
    staleTime: Infinity,
    retry: false,
  })
  return !!data?.testversion
}

export function TestversionBadge({ className }: { className?: string }) {
  const aktiv = useTestversion()
  const tt = useT()
  if (!aktiv) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-orange-500 leading-none',
        className,
      )}
      title={tt(testversionT.hinweis)}
    >
      {tt(testversionT.test)}
    </span>
  )
}
