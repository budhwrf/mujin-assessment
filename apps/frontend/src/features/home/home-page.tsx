import { useState } from 'react'
import { Button } from '@/components/ui/button'

export const HomePage = () => {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          mujin-assessment
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Frontend</h1>
        <p className="text-muted-foreground">
          React, Vite, Tailwind CSS, and shadcn/ui are ready.
        </p>
      </div>
      <Button onClick={() => setCount((current) => current + 1)}>
        Count is {count}
      </Button>
    </main>
  )
}
