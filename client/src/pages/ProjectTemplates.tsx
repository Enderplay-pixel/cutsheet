import { Film, Clock, Users, Clapperboard, Music, Tv } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TemplateData {
  name: string
  format: string
  length_minutes: number
  description: string
  typicalDuration: string
  typicalCrew: string
}

const TEMPLATES: (TemplateData & { icon: any; color: string })[] = [
  {
    name: 'Kurzfilm',
    format: 'Kurzfilm',
    length_minutes: 15,
    description: 'Eigenständiges kurzes Werk für Festivals, Wettbewerbe oder als Visitenkarte.',
    typicalDuration: '5–30 Min.',
    typicalCrew: '5–20 Personen',
    icon: Film,
    color: 'bg-blue-500/10 border-blue-500/25 hover:border-blue-500/50 text-blue-600',
  },
  {
    name: 'Spielfilm',
    format: 'Spielfilm',
    length_minutes: 90,
    description: 'Abendfüllender Kinospielfilm mit vollständiger Produktion.',
    typicalDuration: '80–120 Min.',
    typicalCrew: '30–100+ Personen',
    icon: Clapperboard,
    color: 'bg-purple-500/10 border-purple-500/25 hover:border-purple-500/50 text-purple-600',
  },
  {
    name: 'Werbespot',
    format: 'Werbefilm',
    length_minutes: 1,
    description: 'Werblicher Kurzfilm für TV, Online oder Kino.',
    typicalDuration: '15–60 Sek.',
    typicalCrew: '10–30 Personen',
    icon: Clock,
    color: 'bg-orange-500/10 border-orange-500/25 hover:border-orange-500/50 text-orange-600',
  },
  {
    name: 'Dokumentarfilm',
    format: 'Dokumentarfilm',
    length_minutes: 60,
    description: 'Dokumentarische Arbeit über reale Ereignisse, Menschen oder Themen.',
    typicalDuration: '30–90 Min.',
    typicalCrew: '3–15 Personen',
    icon: Users,
    color: 'bg-teal-500/10 border-teal-500/25 hover:border-teal-500/50 text-teal-600',
  },
  {
    name: 'Serie / Episode',
    format: 'Serie',
    length_minutes: 45,
    description: 'Eine Episode einer fortlaufenden Serie für TV oder Streaming.',
    typicalDuration: '20–60 Min.',
    typicalCrew: '20–60 Personen',
    icon: Tv,
    color: 'bg-green-500/10 border-green-500/25 hover:border-green-500/50 text-green-600',
  },
  {
    name: 'Musikvideo',
    format: 'Musikvideo',
    length_minutes: 4,
    description: 'Visueller Begleiter zu einem Musikstück für Künstler oder Labels.',
    typicalDuration: '3–6 Min.',
    typicalCrew: '5–20 Personen',
    icon: Music,
    color: 'bg-pink-500/10 border-pink-500/25 hover:border-pink-500/50 text-pink-600',
  },
]

interface TemplateSelectorProps {
  onSelect: (template: TemplateData) => void
  selected?: string
}

export function TemplateSelector({ onSelect, selected }: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {TEMPLATES.map(template => {
        const Icon = template.icon
        const isSelected = selected === template.format
        return (
          <button
            key={template.format}
            onClick={() => onSelect(template)}
            className={cn(
              'relative text-left rounded-2xl border-2 p-5 transition-all cursor-pointer group',
              template.color,
              isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            )}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-black/20 flex items-center justify-center mb-3">
              <Icon className="w-5 h-5" />
            </div>

            <div className="font-bold text-base mb-1 text-foreground">{template.name}</div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{template.description}</p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {template.typicalDuration}
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {template.typicalCrew}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// Default export: standalone page that wraps the template selector
// (e.g. for use in routing if needed directly)
export default function ProjectTemplates() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-[28px] sm:text-[34px]">Projektvorlage wählen</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Wähle eine Vorlage, um das neue Projekt vorzubefüllen</p>
      </div>
      <TemplateSelector
        onSelect={template => {
          // When used standalone, redirect or emit — here just log
          console.log('Template selected:', template)
        }}
      />
    </div>
  )
}
