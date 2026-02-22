import { type KeyboardEvent, type ReactNode, useRef } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/cn'

export type SearchInputProps = {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  inputClassName?: string
  leadingIcon?: ReactNode
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Search',
  ariaLabel,
  className,
  inputClassName,
  leadingIcon
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const clearValue = (): void => {
    onValueChange('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape' && value) {
      event.preventDefault()
      event.stopPropagation()
      clearValue()
    }
  }

  return (
    <div
      role="search"
      className={cn(
        'flex items-center gap-2 rounded-md border border-input bg-background p-2',
        className
      )}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <Input
        ref={inputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          onValueChange(event.target.value)
        }}
        className={cn(
          'h-8 border-none bg-transparent shadow-none focus-visible:ring-0',
          inputClassName
        )}
      />
      {value ? (
        <Button
          type="button"
          aria-label="Clear search"
          variant="ghost"
          size="sm"
          onClick={clearValue}
        >
          Clear
        </Button>
      ) : null}
    </div>
  )
}
