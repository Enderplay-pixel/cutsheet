import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { appT } from '@/lib/i18n'
import { useT } from '@/lib/useT'

// Auffangroute für unbekannte Pfade. Ohne sie zeigte React Router seine
// eigene, englische Fehlerseite ("Unexpected Application Error! 404").
export function Component() {
  const tt = useT()
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 text-center space-y-3">
          <p className="font-medium">{tt(appT.notFound)}</p>
          <p className="text-sm text-muted-foreground">{tt(appT.notFoundText)}</p>
          <Button asChild size="sm">
            <Link to="/">{tt(appT.toStart)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
