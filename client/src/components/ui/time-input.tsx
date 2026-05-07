import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { formatTime, parseTime, cn } from '@/lib/utils'

interface TimeInputProps {
  value: number
  onChange: (v: number) => void
  className?: string
  placeholder?: string
}

export function TimeInput({ value, onChange, className, placeholder = '08:00' }: TimeInputProps) {
  const [str, setStr] = useState(formatTime(value || 0))
  useEffect(() => setStr(formatTime(value || 0)), [value])
  return (
    <Input
      value={str}
      onChange={e => setStr(e.target.value)}
      onBlur={() => {
        const parsed = parseTime(str)
        if (!isNaN(parsed)) onChange(parsed)
        else setStr(formatTime(value || 0))
      }}
      className={cn('font-mono text-center', className)}
      placeholder={placeholder}
    />
  )
}
