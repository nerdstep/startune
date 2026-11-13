import { Progress as ProgressPrimitive } from '@base-ui/react/progress'

import { cn } from '@/lib/utils'

function Progress({
  className,
  value,
  thin,
}: {
  className?: string
  value: number | null
  thin?: boolean
}) {
  return (
    <ProgressPrimitive.Root value={value} className={cn('w-full', className)}>
      <ProgressPrimitive.Track
        className={cn('relative w-full overflow-hidden bg-secondary', thin ? 'h-px' : 'h-0.5')}
      >
        <ProgressPrimitive.Indicator className="h-full bg-primary transition-all duration-300" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
