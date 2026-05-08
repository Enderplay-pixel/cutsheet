import { useProjectStore } from '@/store/useProjectStore'
import { t, type Lang } from '@/lib/i18n'

/** Returns a translation helper bound to the current language. */
export function useT() {
  const lang = useProjectStore(s => s.language) as Lang
  return (map: Record<Lang, string>) => t(map, lang)
}
