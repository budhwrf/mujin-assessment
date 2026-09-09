import { toDocument, validateDocument } from '@mujin/map-domain'
import { Check, Download, WrapText } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useMapEditorStore } from '@/store/map-editor-store'

export const JsonEditor = ({ expanded }: { expanded?: boolean }) => {
  const map = useMapEditorStore((state) => state.map)
  const importDocument = useMapEditorStore((state) => state.importDocument)
  const [draft, setDraft] = useState<string | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [apiText, setApiText] = useState('Load or save a map to see the latest API response.')

  const formatted = useMemo(() => JSON.stringify(toDocument(map), null, 2), [map])
  const value = draft ?? formatted
  const dirtyDraft = draft !== null && draft !== formatted

  const validate = () => {
    try {
      const parsed = JSON.parse(value)
      const result = validateDocument(parsed)
      const messages = [...result.errors, ...result.warnings].map(
        (item) => `${item.severity}: ${item.message}`,
      )
      setIssues(messages)
      if (result.valid) {
        importDocument(parsed)
        setDraft(null)
        setApiText(JSON.stringify({ valid: true, warnings: result.warnings }, null, 2))
      }
    } catch {
      setIssues(['error: Unable to parse JSON.'])
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Tabs defaultValue="json" className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="json">Map JSON</TabsTrigger>
            <TabsTrigger value="api">API Response</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            {dirtyDraft && <span className="mr-1 text-xs text-warning">Unapplied edits</span>}
            <Button size="xs" variant="secondary" onClick={validate}>
              <Check />
              Validate
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                try {
                  setDraft(JSON.stringify(JSON.parse(value), null, 2))
                  setIssues([])
                } catch {
                  setIssues(['error: Unable to format invalid JSON.'])
                }
              }}
            >
              <WrapText />
              Format
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                const blob = new Blob([value], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = 'agv-map.json'
                link.click()
                URL.revokeObjectURL(url)
              }}
            >
              <Download />
              Download
            </Button>
          </div>
        </div>
        <TabsContent value="json" className="min-h-0 flex-1">
          <CodePane value={value} expanded={expanded} onChange={(next) => setDraft(next)} />
        </TabsContent>
        <TabsContent value="api" className="min-h-0 flex-1">
          <CodePane value={apiText} readOnly expanded={expanded} />
        </TabsContent>
      </Tabs>
      {issues.length > 0 && (
        <ScrollArea className="max-h-20 rounded-lg border border-warning/30 bg-warning/10">
          <ul className="px-2 py-1.5 text-xs text-warning">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}

const CodePane = ({
  value,
  onChange,
  readOnly,
  expanded,
}: {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  expanded?: boolean
}) => {
  const lines = value.split('\n')
  const gutterRef = useRef<HTMLDivElement>(null)
  const highlighted = useMemo(() => highlightJson(value), [value])

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden rounded-lg border border-border bg-background">
      <div
        ref={gutterRef}
        aria-hidden
        className="w-12 shrink-0 overflow-hidden border-r border-border bg-muted/30 py-3 text-right font-mono text-xs leading-5 text-muted-foreground select-none"
      >
        {lines.map((_, index) => (
          <div key={index} className="px-2">
            {index + 1}
          </div>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        {readOnly ? (
          <ScrollArea className="h-full">
            <pre
              className={`px-3 py-3 font-mono leading-5 whitespace-pre-wrap ${
                expanded ? 'text-[13px]' : 'text-xs'
              }`}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </ScrollArea>
        ) : (
          <>
            <pre
              aria-hidden
              className={`pointer-events-none absolute inset-0 overflow-auto px-3 py-3 font-mono leading-5 whitespace-pre-wrap ${
                expanded ? 'text-[13px]' : 'text-xs'
              }`}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
            <Textarea
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              onScroll={(event) => {
                if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
                const overlay = event.currentTarget.previousElementSibling as HTMLElement | null
                if (overlay) {
                  overlay.scrollTop = event.currentTarget.scrollTop
                  overlay.scrollLeft = event.currentTarget.scrollLeft
                }
              }}
              spellCheck={false}
              aria-label="Map JSON"
              className={`h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-3 font-mono leading-5 text-transparent caret-foreground shadow-none focus-visible:ring-0 ${
                expanded ? 'text-[13px]' : 'text-xs'
              }`}
            />
          </>
        )}
      </div>
    </div>
  )
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const highlightJson = (raw: string) => {
  const escaped = escapeHtml(raw)
  return escaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, stringLiteral: string | undefined, isKey: string | undefined, literal: string | undefined) => {
      if (stringLiteral !== undefined) {
        if (isKey !== undefined) {
          return `<span class="text-primary">${stringLiteral}</span>${isKey}`
        }
        return `<span class="text-chart-4">${stringLiteral}</span>`
      }
      if (literal !== undefined) {
        return `<span class="text-warning">${literal}</span>`
      }
      return `<span class="text-chart-2">${match}</span>`
    },
  )
}
