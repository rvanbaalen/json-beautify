import { useState, useCallback, useMemo } from 'react'
import { create, type Delta } from 'jsondiffpatch'
import { format as formatHtml } from 'jsondiffpatch/formatters/html'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

type DiffViewMode = 'unified' | 'split' | 'annotated'

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified-old' | 'modified-new'
  content: string
}

const diffpatcher = create({
  objectHash: (obj: object) => {
    return JSON.stringify(obj)
  },
  arrays: {
    detectMove: true,
    includeValueOnMove: false,
  },
})

function formatJson(value: unknown, indent: number = 2): string {
  return JSON.stringify(value, null, indent)
}

function computeLineDiff(leftLines: string[], rightLines: string[]): DiffLine[] {
  const result: DiffLine[] = []

  let leftIdx = 0
  let rightIdx = 0

  while (leftIdx < leftLines.length || rightIdx < rightLines.length) {
    const leftLine = leftLines[leftIdx]
    const rightLine = rightLines[rightIdx]

    if (leftIdx >= leftLines.length) {
      result.push({ type: 'added', content: rightLine })
      rightIdx++
    } else if (rightIdx >= rightLines.length) {
      result.push({ type: 'removed', content: leftLine })
      leftIdx++
    } else if (leftLine === rightLine) {
      result.push({ type: 'unchanged', content: leftLine })
      leftIdx++
      rightIdx++
    } else {
      let foundInRight = false
      let foundInLeft = false

      for (let i = rightIdx + 1; i < Math.min(rightIdx + 5, rightLines.length); i++) {
        if (rightLines[i] === leftLine) {
          foundInRight = true
          break
        }
      }

      for (let i = leftIdx + 1; i < Math.min(leftIdx + 5, leftLines.length); i++) {
        if (leftLines[i] === rightLine) {
          foundInLeft = true
          break
        }
      }

      if (!foundInRight && !foundInLeft) {
        result.push({ type: 'modified-old', content: leftLine })
        result.push({ type: 'modified-new', content: rightLine })
        leftIdx++
        rightIdx++
      } else if (foundInRight) {
        result.push({ type: 'removed', content: leftLine })
        leftIdx++
      } else {
        result.push({ type: 'added', content: rightLine })
        rightIdx++
      }
    }
  }

  return result
}

function JsonDiff() {
  const [leftInput, setLeftInput] = useState('')
  const [rightInput, setRightInput] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<DiffViewMode>('unified')
  const [diffResult, setDiffResult] = useState<DiffLine[] | null>(null)
  const [leftParsed, setLeftParsed] = useState<unknown>(null)
  const [rightParsed, setRightParsed] = useState<unknown>(null)
  const [semanticDiff, setSemanticDiff] = useState<Delta | undefined>(undefined)

  const compareDiff = useCallback(() => {
    setError('')
    setDiffResult(null)
    setLeftParsed(null)
    setRightParsed(null)
    setSemanticDiff(undefined)

    if (!leftInput.trim() || !rightInput.trim()) {
      setError('Please enter JSON in both fields')
      return
    }

    try {
      const left = JSON.parse(leftInput)
      const right = JSON.parse(rightInput)

      setLeftParsed(left)
      setRightParsed(right)

      // Use jsondiffpatch for semantic diffing
      const delta = diffpatcher.diff(left, right)
      setSemanticDiff(delta)

      // Format both JSONs for line-by-line comparison
      const leftFormatted = formatJson(left).split('\n')
      const rightFormatted = formatJson(right).split('\n')

      const diff = computeLineDiff(leftFormatted, rightFormatted)
      setDiffResult(diff)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }, [leftInput, rightInput])

  const swapInputs = useCallback(() => {
    setLeftInput(rightInput)
    setRightInput(leftInput)
    setDiffResult(null)
    setSemanticDiff(undefined)
  }, [leftInput, rightInput])

  const clearAll = useCallback(() => {
    setLeftInput('')
    setRightInput('')
    setError('')
    setDiffResult(null)
    setLeftParsed(null)
    setRightParsed(null)
    setSemanticDiff(undefined)
  }, [])

  const loadSample = useCallback(() => {
    const sampleLeft = {
      name: 'JSON Beautifier',
      version: '1.0.0',
      features: ['Format JSON', 'Multiple presets'],
      config: {
        theme: 'light',
        autoFormat: false,
      },
    }
    const sampleRight = {
      name: 'JSON Beautifier Pro',
      version: '2.0.0',
      features: ['Format JSON', 'Multiple presets', 'Diff tool'],
      config: {
        theme: 'dark',
        autoFormat: true,
        newSetting: 'enabled',
      },
    }
    setLeftInput(JSON.stringify(sampleLeft))
    setRightInput(JSON.stringify(sampleRight))
    setDiffResult(null)
    setSemanticDiff(undefined)
    setError('')
  }, [])

  const hasChanges = useMemo(() => {
    return semanticDiff !== undefined
  }, [semanticDiff])

  const stats = useMemo(() => {
    if (!diffResult) return { added: 0, removed: 0, modified: 0 }
    let added = 0
    let removed = 0
    let modified = 0

    for (const line of diffResult) {
      if (line.type === 'added') added++
      else if (line.type === 'removed') removed++
      else if (line.type === 'modified-old') modified++
    }

    return { added, removed, modified }
  }, [diffResult])

  const renderAnnotatedHtml = useMemo(() => {
    if (!leftParsed || !semanticDiff) return null

    try {
      const html = formatHtml(semanticDiff, leftParsed)
      return html
    } catch {
      return null
    }
  }, [leftParsed, semanticDiff])

  const renderDiffLine = (line: DiffLine, index: number) => {
    const baseClasses = 'px-4 py-0.5 font-mono text-sm whitespace-pre'

    switch (line.type) {
      case 'added':
        return (
          <div key={index} className={`${baseClasses} bg-diff-added-bg text-diff-added-foreground`}>
            <span className="inline-block w-8 text-diff-added opacity-70 select-none">+</span>
            {line.content}
          </div>
        )
      case 'removed':
        return (
          <div key={index} className={`${baseClasses} bg-diff-removed-bg text-diff-removed-foreground`}>
            <span className="inline-block w-8 text-diff-removed opacity-70 select-none">-</span>
            {line.content}
          </div>
        )
      case 'modified-old':
        return (
          <div key={index} className={`${baseClasses} bg-diff-removed-bg text-diff-removed-foreground`}>
            <span className="inline-block w-8 text-diff-removed opacity-70 select-none">-</span>
            {line.content}
          </div>
        )
      case 'modified-new':
        return (
          <div key={index} className={`${baseClasses} bg-diff-added-bg text-diff-added-foreground`}>
            <span className="inline-block w-8 text-diff-added opacity-70 select-none">+</span>
            {line.content}
          </div>
        )
      default:
        return (
          <div key={index} className={`${baseClasses} text-muted-foreground`}>
            <span className="inline-block w-8 opacity-50 select-none"> </span>
            {line.content}
          </div>
        )
    }
  }

  const renderSplitView = () => {
    if (!leftParsed || !rightParsed) return null

    const leftLines = formatJson(leftParsed).split('\n')
    const rightLines = formatJson(rightParsed).split('\n')

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Original</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/30 overflow-auto max-h-[400px]">
              {leftLines.map((line, idx) => {
                const diffLine = diffResult?.find(
                  d => (d.type === 'removed' || d.type === 'modified-old') && d.content === line
                )
                const isRemoved = diffLine?.type === 'removed' || diffLine?.type === 'modified-old'
                return (
                  <div
                    key={idx}
                    className={`px-4 py-0.5 font-mono text-sm whitespace-pre ${
                      isRemoved ? 'bg-diff-removed-bg text-diff-removed-foreground' : ''
                    }`}
                  >
                    {line}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Modified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/30 overflow-auto max-h-[400px]">
              {rightLines.map((line, idx) => {
                const diffLine = diffResult?.find(
                  d => (d.type === 'added' || d.type === 'modified-new') && d.content === line
                )
                const isAdded = diffLine?.type === 'added' || diffLine?.type === 'modified-new'
                return (
                  <div
                    key={idx}
                    className={`px-4 py-0.5 font-mono text-sm whitespace-pre ${
                      isAdded ? 'bg-diff-added-bg text-diff-added-foreground' : ''
                    }`}
                  >
                    {line}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="viewMode" className="whitespace-nowrap">
            View Mode:
          </Label>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as DiffViewMode)}>
            <SelectTrigger id="viewMode" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unified">Unified</SelectItem>
              <SelectItem value="split">Side by Side</SelectItem>
              <SelectItem value="annotated">Annotated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="hidden h-8 md:block" />

        <div className="flex gap-2">
          <Button onClick={compareDiff} size="lg">
            Compare
          </Button>
          <Button onClick={swapInputs} variant="outline">
            Swap
          </Button>
          <Button onClick={loadSample} variant="outline">
            Load Sample
          </Button>
          <Button onClick={clearAll} variant="outline">
            Clear
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Original JSON</span>
              <span className="text-sm font-normal text-muted-foreground">
                {leftInput.length} characters
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste original JSON here..."
              className="min-h-[300px] font-mono text-sm"
              value={leftInput}
              onChange={(e) => setLeftInput(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Modified JSON</span>
              <span className="text-sm font-normal text-muted-foreground">
                {rightInput.length} characters
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste modified JSON here..."
              className="min-h-[300px] font-mono text-sm"
              value={rightInput}
              onChange={(e) => setRightInput(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {diffResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Diff Result</span>
              <div className="flex items-center gap-4 text-sm font-normal">
                {!hasChanges ? (
                  <span className="text-muted-foreground">No changes detected</span>
                ) : (
                  <>
                    <span className="text-diff-added">+{stats.added} added</span>
                    <span className="text-diff-removed">-{stats.removed} removed</span>
                    {stats.modified > 0 && (
                      <span className="text-diff-modified">~{stats.modified} modified</span>
                    )}
                  </>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'unified' ? (
              <div className="rounded-md border bg-muted/30 overflow-auto max-h-[500px]">
                {diffResult.map((line, idx) => renderDiffLine(line, idx))}
              </div>
            ) : viewMode === 'split' ? (
              renderSplitView()
            ) : renderAnnotatedHtml ? (
              <div
                className="jsondiffpatch-annotated rounded-md border bg-muted/30 overflow-auto max-h-[500px] p-4 font-mono text-sm"
                dangerouslySetInnerHTML={{ __html: renderAnnotatedHtml }}
              />
            ) : (
              <div className="rounded-md border bg-muted/30 overflow-auto max-h-[500px]">
                {diffResult.map((line, idx) => renderDiffLine(line, idx))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default JsonDiff
