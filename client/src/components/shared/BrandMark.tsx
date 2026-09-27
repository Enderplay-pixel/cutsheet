// Wortmarke: eine abstrahierte Klappe — schräg gestreifte Leiste über
// einem schlichten Blatt. Zeichnet mit currentColor, passt sich also
// beiden Modi an.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="3" y="9.5" width="18" height="11.5" rx="1.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.6 8 20.4 5.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.2 7.2 9.6 9.5M13 6.4l1.4 2.3M17.8 5.6l1.4 2.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 14.5h6M7 17.2h9.5" stroke="hsl(var(--signal))" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
