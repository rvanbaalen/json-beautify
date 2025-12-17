import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { create, type Delta } from 'jsondiffpatch'
import { format as formatHtml } from 'jsondiffpatch/formatters/html'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { CodeEditor } from '@/components/code-editor'

const MotionCard = motion.create(Card)

type DiffViewMode = 'unified' | 'split' | 'annotated'

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified-old' | 'modified-new'
  content: string
  lineNumber?: number
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
      result.push({ type: 'added', content: rightLine, lineNumber: rightIdx + 1 })
      rightIdx++
    } else if (rightIdx >= rightLines.length) {
      result.push({ type: 'removed', content: leftLine, lineNumber: leftIdx + 1 })
      leftIdx++
    } else if (leftLine === rightLine) {
      result.push({ type: 'unchanged', content: leftLine, lineNumber: leftIdx + 1 })
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
        result.push({ type: 'modified-old', content: leftLine, lineNumber: leftIdx + 1 })
        result.push({ type: 'modified-new', content: rightLine, lineNumber: rightIdx + 1 })
        leftIdx++
        rightIdx++
      } else if (foundInRight) {
        result.push({ type: 'removed', content: leftLine, lineNumber: leftIdx + 1 })
        leftIdx++
      } else {
        result.push({ type: 'added', content: rightLine, lineNumber: rightIdx + 1 })
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
    const baseClasses = 'px-4 py-0.5 font-mono text-sm whitespace-pre flex'
    const lineNumClasses = 'w-12 text-right pr-4 select-none opacity-50 shrink-0'

    switch (line.type) {
      case 'added':
        return (
          <div key={index} className={`${baseClasses} bg-diff-added-bg text-diff-added-foreground`}>
            <span className={lineNumClasses}>{line.lineNumber}</span>
            <span className="inline-block w-6 text-diff-added opacity-70 select-none shrink-0">+</span>
            <span className="flex-1">{line.content}</span>
          </div>
        )
      case 'removed':
        return (
          <div key={index} className={`${baseClasses} bg-diff-removed-bg text-diff-removed-foreground`}>
            <span className={lineNumClasses}>{line.lineNumber}</span>
            <span className="inline-block w-6 text-diff-removed opacity-70 select-none shrink-0">-</span>
            <span className="flex-1">{line.content}</span>
          </div>
        )
      case 'modified-old':
        return (
          <div key={index} className={`${baseClasses} bg-diff-removed-bg text-diff-removed-foreground`}>
            <span className={lineNumClasses}>{line.lineNumber}</span>
            <span className="inline-block w-6 text-diff-removed opacity-70 select-none shrink-0">-</span>
            <span className="flex-1">{line.content}</span>
          </div>
        )
      case 'modified-new':
        return (
          <div key={index} className={`${baseClasses} bg-diff-added-bg text-diff-added-foreground`}>
            <span className={lineNumClasses}>{line.lineNumber}</span>
            <span className="inline-block w-6 text-diff-added opacity-70 select-none shrink-0">+</span>
            <span className="flex-1">{line.content}</span>
          </div>
        )
      default:
        return (
          <div key={index} className={`${baseClasses} text-muted-foreground`}>
            <span className={lineNumClasses}>{line.lineNumber}</span>
            <span className="inline-block w-6 opacity-50 select-none shrink-0"> </span>
            <span className="flex-1">{line.content}</span>
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
                    className={`px-4 py-0.5 font-mono text-sm whitespace-pre flex ${
                      isRemoved ? 'bg-diff-removed-bg text-diff-removed-foreground' : ''
                    }`}
                  >
                    <span className="w-12 text-right pr-4 select-none opacity-50 shrink-0">{idx + 1}</span>
                    <span className="flex-1">{line}</span>
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
                    className={`px-4 py-0.5 font-mono text-sm whitespace-pre flex ${
                      isAdded ? 'bg-diff-added-bg text-diff-added-foreground' : ''
                    }`}
                  >
                    <span className="w-12 text-right pr-4 select-none opacity-50 shrink-0">{idx + 1}</span>
                    <span className="flex-1">{line}</span>
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
      <motion.div
        className="flex flex-wrap items-center justify-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2">
          <Label htmlFor="viewMode" className="whitespace-nowrap font-medium">
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
      </motion.div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 md:grid-cols-2">
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2 }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="font-serif text-lg italic">Original JSON</span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {leftInput.length} chars
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeEditor
              value={leftInput}
              onChange={setLeftInput}
              placeholder="Paste original JSON here..."
              minHeight="300px"
            />
          </CardContent>
        </MotionCard>

        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2 }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="font-serif text-lg italic">Modified JSON</span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {rightInput.length} chars
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeEditor
              value={rightInput}
              onChange={setRightInput}
              placeholder="Paste modified JSON here..."
              minHeight="300px"
            />
          </CardContent>
        </MotionCard>
      </div>

      <AnimatePresence mode="wait">
        {diffResult && (
          <MotionCard
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="font-serif text-lg italic">Diff Result</span>
                <div className="flex items-center gap-4 font-mono text-xs font-normal">
                  {!hasChanges ? (
                    <span className="text-muted-foreground">No changes detected</span>
                  ) : (
                    <>
                      <motion.span
                        className="text-diff-added"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        +{stats.added} added
                      </motion.span>
                      <motion.span
                        className="text-diff-removed"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 }}
                      >
                        -{stats.removed} removed
                      </motion.span>
                      {stats.modified > 0 && (
                        <motion.span
                          className="text-diff-modified"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          ~{stats.modified} modified
                        </motion.span>
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
          </MotionCard>
        )}
      </AnimatePresence>
    </div>
  )
}

export default JsonDiff
