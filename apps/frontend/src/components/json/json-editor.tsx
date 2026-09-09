import { toDocument, validateDocument, type MapDocument, type ValidationIssue } from '@mujin/map-domain'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Check, Download, WrapText } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import type * as Monaco from 'monaco-editor'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMapEditorStore } from '@/store/map-editor-store'

const MUJIN_THEME = 'mujin-dark'
const MARKER_OWNER = 'agv-map-validation'

const defineMujinTheme = (monaco: typeof Monaco) => {
  monaco.editor.defineTheme(MUJIN_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'F4F6FA' },
      { token: 'comment', foreground: '8B95AB' },
      { token: 'string', foreground: '7DD3AE' },
      { token: 'number', foreground: 'E8C47C' },
      { token: 'keyword', foreground: '7EA8FF' },
      { token: 'delimiter', foreground: '9AA3B8' },
      { token: 'delimiter.bracket', foreground: '9AA3B8' },
    ],
    colors: {
      'editor.background': '#181C28',
      'editor.foreground': '#F4F6FA',
      'editorLineNumber.foreground': '#6B758A',
      'editorLineNumber.activeForeground': '#AEB6C8',
      'editorCursor.foreground': '#7EA8FF',
      'editor.selectionBackground': '#2A3550',
      'editor.inactiveSelectionBackground': '#222A3D',
      'editor.lineHighlightBackground': '#1F2535',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background': '#2A3142',
      'editorIndentGuide.activeBackground': '#3A4560',
      'editorWidget.background': '#1E2433',
      'editorWidget.border': '#343B4F',
      'editorSuggestWidget.background': '#1E2433',
      'editorSuggestWidget.border': '#343B4F',
      'editorSuggestWidget.selectedBackground': '#2A3550',
      'editorGutter.background': '#181C28',
      'scrollbarSlider.background': '#343B4F66',
      'scrollbarSlider.hoverBackground': '#4A556E88',
      'scrollbarSlider.activeBackground': '#5B6A8888',
      'inputValidation.errorBackground': '#3A1F24',
      'inputValidation.errorBorder': '#E06A5C',
      'inputValidation.warningBackground': '#3A3018',
      'inputValidation.warningBorder': '#E0B45C',
    },
  })
}

const offsetToPosition = (text: string, offset: number) => {
  let line = 1
  let column = 1
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }
  return { line, column }
}

const locateNodeRange = (text: string, nodeIndex: number) => {
  const nodesKey = text.indexOf('"nodes"')
  if (nodesKey < 0) return null
  const arrayStart = text.indexOf('[', nodesKey)
  if (arrayStart < 0) return null

  let depth = 0
  let inString = false
  let escape = false
  let objectIndex = -1
  let objectStart = -1

  for (let index = arrayStart; index < text.length; index += 1) {
    const char = text[index] ?? ''

    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 1) {
        objectIndex += 1
        if (objectIndex === nodeIndex) objectStart = index
      }
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 1 && objectIndex === nodeIndex && objectStart >= 0) {
        return { start: objectStart, end: index + 1 }
      }
      continue
    }

    if (char === '[' && depth === 0) {
      depth = 1
      continue
    }

    if (char === ']' && depth === 1) break
  }

  return null
}

const issuesToMarkers = (
  monaco: typeof Monaco,
  text: string,
  issues: ValidationIssue[],
): Monaco.editor.IMarkerData[] =>
  issues.map((issue) => {
    const range =
      issue.nodeIndex === undefined ? null : locateNodeRange(text, issue.nodeIndex)
    const start = range ? offsetToPosition(text, range.start) : { line: 1, column: 1 }
    const end = range ? offsetToPosition(text, range.end) : { line: 1, column: 2 }

    return {
      severity:
        issue.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
      message: issue.message,
      startLineNumber: start.line,
      startColumn: start.column,
      endLineNumber: end.line,
      endColumn: Math.max(end.column, start.column + 1),
      source: 'AGV map',
      code: issue.code,
    }
  })

const setValidationMarkers = (
  monaco: typeof Monaco | null,
  editor: MonacoEditor.IStandaloneCodeEditor | null,
  text: string,
  issues: ValidationIssue[],
) => {
  if (!monaco || !editor) return
  const model = editor.getModel()
  if (!model) return
  monaco.editor.setModelMarkers(model, MARKER_OWNER, issuesToMarkers(monaco, text, issues))
}

const clearValidationMarkers = (
  monaco: typeof Monaco | null,
  editor: MonacoEditor.IStandaloneCodeEditor | null,
) => {
  if (!monaco || !editor) return
  const model = editor.getModel()
  if (!model) return
  monaco.editor.setModelMarkers(model, MARKER_OWNER, [])
}

export const JsonEditor = ({ expanded }: { expanded?: boolean }) => {
  const map = useMapEditorStore((state) => state.map)
  const importDocument = useMapEditorStore((state) => state.importDocument)
  const [draft, setDraft] = useState<string | null>(null)
  const [apiText, setApiText] = useState('Load or save a map to see the latest API response.')
  const [liveStatus, setLiveStatus] = useState<'idle' | 'syncing' | 'invalid'>('idle')
  const [warningCount, setWarningCount] = useState(0)
  const mapEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const lastAppliedRef = useRef<string>('')

  const formatted = useMemo(() => JSON.stringify(toDocument(map), null, 2), [map])
  const value = draft ?? formatted
  const dirtyDraft = draft !== null && draft !== formatted

  const applyMarkers = (text: string, issues: ValidationIssue[]) => {
    setWarningCount(issues.filter((issue) => issue.severity === 'warning').length)
    setValidationMarkers(monacoRef.current, mapEditorRef.current, text, issues)
  }

  const validate = () => {
    try {
      const parsed = JSON.parse(value) as MapDocument
      const result = validateDocument(parsed)
      applyMarkers(value, [...result.errors, ...result.warnings])
      if (result.valid) {
        lastAppliedRef.current = JSON.stringify(parsed)
        importDocument(parsed, undefined, { silent: false, history: true })
        setDraft(null)
        setLiveStatus('idle')
        setApiText(JSON.stringify({ valid: true, warnings: result.warnings }, null, 2))
      } else {
        setLiveStatus('invalid')
      }
    } catch {
      clearValidationMarkers(monacoRef.current, mapEditorRef.current)
      setWarningCount(0)
      setLiveStatus('invalid')
    }
  }

  useEffect(() => {
    if (draft === null) {
      setLiveStatus('idle')
      return
    }

    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(draft) as MapDocument
        const result = validateDocument(parsed)
        applyMarkers(draft, [...result.errors, ...result.warnings])

        if (!result.valid) {
          setLiveStatus('invalid')
          return
        }

        const fingerprint = JSON.stringify(parsed)
        if (fingerprint === lastAppliedRef.current) {
          setLiveStatus('idle')
          return
        }

        lastAppliedRef.current = fingerprint
        importDocument(parsed, undefined, { silent: true, history: false })
        setLiveStatus('syncing')
        window.setTimeout(() => setLiveStatus('idle'), 600)
      } catch {
        clearValidationMarkers(monacoRef.current, mapEditorRef.current)
        setWarningCount(0)
        setLiveStatus('invalid')
      }
    }, 450)

    return () => window.clearTimeout(timer)
  }, [draft, importDocument])

  const formatJson = async () => {
    const instance = mapEditorRef.current
    if (instance) {
      await instance.getAction('editor.action.formatDocument')?.run()
      setDraft(instance.getValue())
      return
    }

    try {
      setDraft(JSON.stringify(JSON.parse(value), null, 2))
    } catch {
      setLiveStatus('invalid')
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
            {liveStatus === 'syncing' && (
              <span className="mr-1 text-xs text-success">Canvas updated</span>
            )}
            {liveStatus === 'invalid' && dirtyDraft && (
              <span className="mr-1 text-xs text-warning">Waiting for valid JSON</span>
            )}
            {warningCount > 0 && liveStatus !== 'invalid' && (
              <span className="mr-1 text-xs text-warning">
                {warningCount} warning{warningCount === 1 ? '' : 's'} in editor
              </span>
            )}
            {dirtyDraft && liveStatus === 'idle' && warningCount === 0 && (
              <span className="mr-1 text-xs text-muted-foreground">Editing</span>
            )}
            <Button size="xs" variant="secondary" onClick={validate}>
              <Check />
              Validate
            </Button>
            <Button size="xs" variant="ghost" onClick={() => void formatJson()}>
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
          <CodePane
            value={value}
            expanded={expanded}
            onChange={setDraft}
            onMount={(instance, monaco) => {
              defineMujinTheme(monaco)
              monaco.editor.setTheme(MUJIN_THEME)
              mapEditorRef.current = instance
              monacoRef.current = monaco
            }}
          />
        </TabsContent>
        <TabsContent value="api" className="min-h-0 flex-1">
          <CodePane
            value={apiText}
            readOnly
            expanded={expanded}
            onMount={(_instance, monaco) => {
              defineMujinTheme(monaco)
              monaco.editor.setTheme(MUJIN_THEME)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const CodePane = ({
  value,
  onChange,
  onMount,
  readOnly,
  expanded,
}: {
  value: string
  onChange?: (value: string) => void
  onMount?: OnMount
  readOnly?: boolean
  expanded?: boolean
}) => (
  <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border bg-background">
    <Editor
      height="100%"
      defaultLanguage="json"
      theme={MUJIN_THEME}
      beforeMount={(monaco) => {
        defineMujinTheme(monaco)
      }}
      value={value}
      onChange={(next) => onChange?.(next ?? '')}
      onMount={onMount}
      loading={<div className="p-3 text-xs text-muted-foreground">Loading editor...</div>}
      options={{
        readOnly: Boolean(readOnly),
        minimap: { enabled: false },
        fontSize: expanded ? 13 : 12,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        formatOnPaste: true,
        folding: true,
        renderLineHighlight: 'line',
        renderValidationDecorations: 'on',
        padding: { top: 8, bottom: 8 },
        overviewRulerLanes: 2,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  </div>
)
