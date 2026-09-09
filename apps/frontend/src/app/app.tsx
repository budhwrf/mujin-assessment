import { TooltipProvider } from '@/components/ui/tooltip'
import { EditorShell } from '@/components/layout/editor-shell'

export const App = () => {
  return (
    <TooltipProvider>
      <EditorShell />
    </TooltipProvider>
  )
}
