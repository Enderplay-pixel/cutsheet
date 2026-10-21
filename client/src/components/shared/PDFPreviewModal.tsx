import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink } from 'lucide-react'
import { useT } from '@/lib/useT'
import { pdfPreviewT } from '@/lib/texte/komponenten/Shared'

interface PDFPreviewModalProps {
  open: boolean
  onClose: () => void
  url: string
  title: string
}

export function PDFPreviewModal({ open, onClose, url, title }: PDFPreviewModalProps) {
  const tt = useT()
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  {tt(pdfPreviewT.oeffnen)}
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={url} download>
                  <Download className="w-4 h-4 mr-1" />
                  {tt(pdfPreviewT.download)}
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <iframe src={url} className="flex-1 w-full rounded-md border" title={title} />
      </DialogContent>
    </Dialog>
  )
}
