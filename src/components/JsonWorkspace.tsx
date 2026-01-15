import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { create, type Delta } from 'jsondiffpatch'
import { format as formatHtml } from 'jsondiffpatch/formatters/html'
import ReactMarkdown from 'react-markdown'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeEditor, type EditorLanguage } from '@/components/code-editor'
import {
  ArrowLeftRight,
  Sparkles,
  GitCompare,
  Copy,
  Check,
  Trash2,
  FileJson,
  FileText,
  X,
  Eye,
  Code,
} from 'lucide-react'

// Content type
type ContentType = 'json' | 'markdown'

// Markdown output view mode
type MarkdownOutputView = 'code' | 'rendered'

const MotionCard = motion.create(Card)

// Beautify presets
interface FormatPreset {
  name: string
  indent: number | string
  sortKeys: boolean
}

const presets: Record<string, FormatPreset> = {
  standard: { name: 'Standard (2 spaces)', indent: 2, sortKeys: false },
  compact: { name: 'Compact (minified)', indent: 0, sortKeys: false },
  expanded: { name: 'Expanded (4 spaces)', indent: 4, sortKeys: false },
  tab: { name: 'Tab indented', indent: '\t', sortKeys: false },
  sorted: { name: 'Sorted keys (2 spaces)', indent: 2, sortKeys: true },
  sortedExpanded: { name: 'Sorted keys (4 spaces)', indent: 4, sortKeys: true },
}

// Diff types
type DiffViewMode = 'unified' | 'split' | 'annotated'

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified-old' | 'modified-new'
  content: string
  lineNumber?: number
}

const diffpatcher = create({
  objectHash: (obj: object) => JSON.stringify(obj),
  arrays: { detectMove: true, includeValueOnMove: false },
})

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sortObjectKeys)
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
      return sorted
    }, {} as Record<string, unknown>)
}

function formatJson(value: unknown, indent: number | string = 2): string {
  const ind = indent === 0 ? undefined : indent
  return JSON.stringify(value, null, ind)
}

// Markdown beautify presets
interface MarkdownPreset {
  name: string
  normalizeHeadings: boolean
  normalizeListIndent: number
  trimTrailingWhitespace: boolean
  ensureNewlineAtEnd: boolean
  normalizeBlankLines: boolean
}

const markdownPresets: Record<string, MarkdownPreset> = {
  standard: {
    name: 'Standard',
    normalizeHeadings: true,
    normalizeListIndent: 2,
    trimTrailingWhitespace: true,
    ensureNewlineAtEnd: true,
    normalizeBlankLines: true,
  },
  compact: {
    name: 'Compact',
    normalizeHeadings: true,
    normalizeListIndent: 2,
    trimTrailingWhitespace: true,
    ensureNewlineAtEnd: true,
    normalizeBlankLines: false,
  },
  expanded: {
    name: 'Expanded (4-space lists)',
    normalizeHeadings: true,
    normalizeListIndent: 4,
    trimTrailingWhitespace: true,
    ensureNewlineAtEnd: true,
    normalizeBlankLines: true,
  },
}

function formatMarkdown(content: string, preset: MarkdownPreset): string {
  let lines = content.split('\n')

  // Trim trailing whitespace from each line
  if (preset.trimTrailingWhitespace) {
    lines = lines.map(line => line.trimEnd())
  }

  // Normalize heading spacing (ensure space after #)
  if (preset.normalizeHeadings) {
    lines = lines.map(line => {
      const headingMatch = line.match(/^(#{1,6})([^\s#].*)$/)
      if (headingMatch) {
        return `${headingMatch[1]} ${headingMatch[2].trim()}`
      }
      return line
    })
  }

  // Normalize list indentation
  const indentSize = preset.normalizeListIndent
  lines = lines.map(line => {
    // Match unordered list items (-, *, +) with any amount of leading whitespace
    const unorderedMatch = line.match(/^(\s*)([-*+])(\s+)(.*)$/)
    if (unorderedMatch) {
      const [, leadingSpace, marker, , text] = unorderedMatch
      // Calculate the nesting level based on original indentation
      const originalIndent = leadingSpace.length
      const level = Math.floor(originalIndent / 2) // Assume original was ~2 spaces per level
      const newIndent = ' '.repeat(level * indentSize)
      return `${newIndent}${marker} ${text}`
    }

    // Match ordered list items (1., 2., etc.)
    const orderedMatch = line.match(/^(\s*)(\d+\.)(\s+)(.*)$/)
    if (orderedMatch) {
      const [, leadingSpace, marker, , text] = orderedMatch
      const originalIndent = leadingSpace.length
      const level = Math.floor(originalIndent / 2)
      const newIndent = ' '.repeat(level * indentSize)
      return `${newIndent}${marker} ${text}`
    }

    return line
  })

  // Normalize blank lines (max 2 consecutive)
  if (preset.normalizeBlankLines) {
    const result: string[] = []
    let consecutiveBlankLines = 0
    for (const line of lines) {
      if (line.trim() === '') {
        consecutiveBlankLines++
        if (consecutiveBlankLines <= 1) {
          result.push(line)
        }
      } else {
        consecutiveBlankLines = 0
        result.push(line)
      }
    }
    lines = result
  }

  let formatted = lines.join('\n')

  // Ensure newline at end
  if (preset.ensureNewlineAtEnd && !formatted.endsWith('\n')) {
    formatted += '\n'
  }

  return formatted
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
        if (rightLines[i] === leftLine) { foundInRight = true; break }
      }
      for (let i = leftIdx + 1; i < Math.min(leftIdx + 5, leftLines.length); i++) {
        if (leftLines[i] === rightLine) { foundInLeft = true; break }
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

type WorkspaceMode = 'idle' | 'beautify' | 'compare'

export function JsonWorkspace() {
  // Content type
  const [contentType, setContentType] = useState<ContentType>('json')

  // Inputs
  const [primaryInput, setPrimaryInput] = useState('')
  const [secondaryInput, setSecondaryInput] = useState('')

  // Beautify state
  const [selectedPreset, setSelectedPreset] = useState('standard')
  const [selectedMarkdownPreset, setSelectedMarkdownPreset] = useState('standard')
  const [beautifiedOutput, setBeautifiedOutput] = useState('')

  // Diff state
  const [viewMode, setViewMode] = useState<DiffViewMode>('unified')
  const [diffResult, setDiffResult] = useState<DiffLine[] | null>(null)
  const [leftParsed, setLeftParsed] = useState<unknown>(null)
  const [rightParsed, setRightParsed] = useState<unknown>(null)
  const [semanticDiff, setSemanticDiff] = useState<Delta | undefined>(undefined)

  // UI state
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showSecondary, setShowSecondary] = useState(false)
  const [markdownOutputView, setMarkdownOutputView] = useState<MarkdownOutputView>('code')

  // Determine current mode based on content
  const currentMode: WorkspaceMode = useMemo(() => {
    const hasPrimary = primaryInput.trim().length > 0
    const hasSecondary = secondaryInput.trim().length > 0

    if (!hasPrimary) return 'idle'
    if (hasSecondary || showSecondary) return 'compare'
    return 'beautify'
  }, [primaryInput, secondaryInput, showSecondary])

  // Auto-compute beautified output when in beautify mode (derived state - no setState needed)
  const beautifiedResult = useMemo(() => {
    if (currentMode !== 'beautify' || !primaryInput.trim()) {
      return { output: '', error: '' }
    }

    if (contentType === 'markdown') {
      // Markdown beautification - no parsing needed, just format
      const preset = markdownPresets[selectedMarkdownPreset]
      const formatted = formatMarkdown(primaryInput, preset)
      return { output: formatted, error: '' }
    }

    // JSON beautification
    try {
      let parsed = JSON.parse(primaryInput)
      const preset = presets[selectedPreset]

      if (preset.sortKeys) {
        parsed = sortObjectKeys(parsed)
      }

      const formatted = formatJson(parsed, preset.indent)
      return { output: formatted, error: '' }
    } catch (e) {
      return {
        output: '',
        error: `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`
      }
    }
  }, [primaryInput, selectedPreset, selectedMarkdownPreset, currentMode, contentType])

  // Use derived beautified output or state-based output (for copy functionality)
  const displayedBeautifiedOutput = beautifiedResult.output || beautifiedOutput
  const displayedError = beautifiedResult.error || error

  const compareDiff = useCallback(() => {
    setError('')
    setDiffResult(null)
    setLeftParsed(null)
    setRightParsed(null)
    setSemanticDiff(undefined)
    setBeautifiedOutput('')

    if (!primaryInput.trim() || !secondaryInput.trim()) {
      setError(`Please enter ${contentType === 'markdown' ? 'markdown' : 'JSON'} in both panels to compare`)
      return
    }

    if (contentType === 'markdown') {
      // Markdown comparison - simple line-by-line diff
      const leftLines = primaryInput.split('\n')
      const rightLines = secondaryInput.split('\n')
      const diff = computeLineDiff(leftLines, rightLines)
      setDiffResult(diff)
      // Store raw content for split view
      setLeftParsed(primaryInput)
      setRightParsed(secondaryInput)
      return
    }

    // JSON comparison
    try {
      const left = JSON.parse(primaryInput)
      const right = JSON.parse(secondaryInput)

      setLeftParsed(left)
      setRightParsed(right)

      const delta = diffpatcher.diff(left, right)
      setSemanticDiff(delta)

      const leftFormatted = formatJson(left).split('\n')
      const rightFormatted = formatJson(right).split('\n')

      const diff = computeLineDiff(leftFormatted, rightFormatted)
      setDiffResult(diff)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }, [primaryInput, secondaryInput, contentType])

  const swapInputs = useCallback(() => {
    setPrimaryInput(secondaryInput)
    setSecondaryInput(primaryInput)
    setDiffResult(null)
    setSemanticDiff(undefined)
  }, [primaryInput, secondaryInput])

  const copyToClipboard = useCallback(async () => {
    const output = beautifiedResult.output
    if (output) {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [beautifiedResult.output])

  const clearAll = useCallback(() => {
    setPrimaryInput('')
    setSecondaryInput('')
    setError('')
    setBeautifiedOutput('')
    setDiffResult(null)
    setLeftParsed(null)
    setRightParsed(null)
    setSemanticDiff(undefined)
    setCopied(false)
    setShowSecondary(false)
  }, [])

  const clearSecondary = useCallback(() => {
    setSecondaryInput('')
    setDiffResult(null)
    setSemanticDiff(undefined)
    setShowSecondary(false)
  }, [])

  const loadSample = useCallback(() => {
    if (contentType === 'markdown') {
      // Markdown samples
      if (currentMode === 'compare' || showSecondary) {
        const sampleLeftMd = `# Project Documentation

## Overview
This is the original documentation.

## Features
- Feature one
- Feature two
  - Sub-feature A
  - Sub-feature B

## Installation
Run the following command:
\`\`\`bash
npm install
\`\`\`

## License
MIT`
        const sampleRightMd = `# Project Documentation

## Overview
This is the updated documentation with changes.

## Features
- Feature one (improved)
- Feature two
  - Sub-feature A
  - Sub-feature B
  - Sub-feature C (new!)
- Feature three (new)

## Installation
Run the following command:
\`\`\`bash
npm install my-package
\`\`\`

## Configuration
Add a config file to customize behavior.

## License
MIT`
        setPrimaryInput(sampleLeftMd)
        setSecondaryInput(sampleRightMd)
      } else {
        const sampleMd = `#My Poorly Formatted Markdown

##Introduction
This markdown has   some    formatting issues.

##Features
-  Feature one
-Feature two
   -   Sub-item with weird indentation
   -Sub-item without space
      - Deeply nested item

##Code Example
\`\`\`javascript
const x = 1;
\`\`\`


##Conclusion
This needs beautification!   `
        setPrimaryInput(sampleMd)
      }
    } else {
      // JSON samples
      if (currentMode === 'compare' || showSecondary) {
        const sampleLeft = {
          name: 'JSON Beautifier',
          version: '1.0.0',
          features: ['Format JSON', 'Multiple presets'],
          config: { theme: 'light', autoFormat: false },
        }
        const sampleRight = {
          name: 'JSON Beautifier Pro',
          version: '2.0.0',
          features: ['Format JSON', 'Multiple presets', 'Diff tool'],
          config: { theme: 'dark', autoFormat: true, newSetting: 'enabled' },
        }
        setPrimaryInput(JSON.stringify(sampleLeft))
        setSecondaryInput(JSON.stringify(sampleRight))
      } else {
        const sample = {
          name: 'JSON Beautifier',
          version: '1.0.0',
          features: ['Format JSON', 'Multiple presets', 'Sort keys', 'Copy to clipboard'],
          config: {
            theme: 'light',
            autoFormat: false,
            settings: { indentation: 2, sortKeys: false },
          },
          data: [1, 2, 3, { nested: true }],
        }
        setPrimaryInput(JSON.stringify(sample))
      }
    }
    setError('')
    setDiffResult(null)
    setSemanticDiff(undefined)
  }, [currentMode, showSecondary, contentType])

  const enableCompareMode = useCallback(() => {
    setShowSecondary(true)
    setBeautifiedOutput('')
  }, [])

  // Stats for diff
  const stats = useMemo(() => {
    if (!diffResult) return { added: 0, removed: 0, modified: 0 }
    let added = 0, removed = 0, modified = 0
    for (const line of diffResult) {
      if (line.type === 'added') added++
      else if (line.type === 'removed') removed++
      else if (line.type === 'modified-old') modified++
    }
    return { added, removed, modified }
  }, [diffResult])

  const hasChanges = contentType === 'markdown'
    ? (diffResult !== null && diffResult.some(line => line.type !== 'unchanged'))
    : semanticDiff !== undefined

  const renderAnnotatedHtml = useMemo(() => {
    if (!leftParsed || !semanticDiff) return null
    try {
      return formatHtml(semanticDiff, leftParsed)
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

    // For markdown, leftParsed/rightParsed are strings; for JSON they are objects
    const leftLines = contentType === 'markdown'
      ? (leftParsed as string).split('\n')
      : formatJson(leftParsed).split('\n')
    const rightLines = contentType === 'markdown'
      ? (rightParsed as string).split('\n')
      : formatJson(rightParsed).split('\n')

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Original</CardTitle>
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
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Modified</CardTitle>
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

  const isCompareMode = currentMode === 'compare' || showSecondary

  // Handler for content type change - clears inputs when switching
  const handleContentTypeChange = useCallback((value: string) => {
    setContentType(value as ContentType)
    // Clear inputs when switching content types
    setPrimaryInput('')
    setSecondaryInput('')
    setError('')
    setBeautifiedOutput('')
    setDiffResult(null)
    setSemanticDiff(undefined)
    setShowSecondary(false)
  }, [])

  return (
    <div className="space-y-6">
      {/* Content type toggle */}
      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <Tabs value={contentType} onValueChange={handleContentTypeChange}>
          <TabsList>
            <TabsTrigger value="json" className="gap-1.5">
              <FileJson className="w-4 h-4" />
              JSON
            </TabsTrigger>
            <TabsTrigger value="markdown" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Markdown
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Mode indicator and controls */}
      <motion.div
        className="flex flex-wrap items-center justify-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Mode badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentMode}-${contentType}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              currentMode === 'compare'
                ? 'bg-primary/10 text-primary'
                : currentMode === 'beautify'
                ? 'bg-amber/10 text-amber-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {currentMode === 'compare' ? (
              <>
                <GitCompare className="w-4 h-4" />
                Compare Mode
              </>
            ) : currentMode === 'beautify' ? (
              <>
                <Sparkles className="w-4 h-4" />
                Beautify Mode
              </>
            ) : (
              <>
                {contentType === 'markdown' ? <FileText className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
                Ready
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <Separator orientation="vertical" className="hidden h-8 md:block" />

        {/* Format preset (beautify mode) */}
        <AnimatePresence mode="wait">
          {!isCompareMode && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <Label htmlFor="preset" className="whitespace-nowrap font-medium">
                Format:
              </Label>
              {contentType === 'json' ? (
                <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                  <SelectTrigger id="preset" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(presets).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedMarkdownPreset} onValueChange={setSelectedMarkdownPreset}>
                  <SelectTrigger id="preset" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(markdownPresets).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* View mode (compare mode) */}
        <AnimatePresence mode="wait">
          {isCompareMode && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <Label htmlFor="viewMode" className="whitespace-nowrap font-medium">
                View:
              </Label>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as DiffViewMode)}>
                <SelectTrigger id="viewMode" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified</SelectItem>
                  <SelectItem value="split">Side by Side</SelectItem>
                  {/* Annotated view only available for JSON (semantic diff) */}
                  {contentType === 'json' && (
                    <SelectItem value="annotated">Annotated</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </motion.div>
          )}
        </AnimatePresence>

        <Separator orientation="vertical" className="hidden h-8 md:block" />

        {/* Actions */}
        <div className="flex gap-2">
          {isCompareMode && (
            <>
              <Button onClick={compareDiff}>
                <GitCompare className="w-4 h-4" />
                Compare
              </Button>
              <Button onClick={swapInputs} variant="outline" size="icon" title="Swap inputs">
                <ArrowLeftRight className="w-4 h-4" />
              </Button>
            </>
          )}
          {!isCompareMode && currentMode === 'beautify' && displayedBeautifiedOutput && (
            <Button onClick={copyToClipboard} variant={copied ? 'default' : 'outline'}>
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </Button>
          )}
          <Button onClick={loadSample} variant="outline">
            {contentType === 'markdown' ? <FileText className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
            Sample
          </Button>
          <Button onClick={clearAll} variant="outline" size="icon" title="Clear all">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Error display */}
      <AnimatePresence mode="wait">
        {displayedError && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
              {displayedError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input panels */}
      <div className={`grid gap-6 ${isCompareMode ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
        {/* Primary input */}
        <MotionCard
          className="flex flex-col"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2 }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="font-serif text-lg italic">
                {isCompareMode ? 'Original' : 'Input'}
              </span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {primaryInput.length} chars
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <CodeEditor
              value={primaryInput}
              onChange={setPrimaryInput}
              placeholder={contentType === 'markdown' ? 'Paste your markdown here...' : 'Paste your JSON here...'}
              minHeight={isCompareMode ? '300px' : 'calc(100vh - 480px)'}
              language={contentType as EditorLanguage}
            />
          </CardContent>
        </MotionCard>

        {/* Secondary input OR Output */}
        <AnimatePresence mode="wait">
          {isCompareMode ? (
            <MotionCard
              key="compare-input"
              className="flex flex-col relative"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 h-7 w-7 opacity-50 hover:opacity-100 z-10"
                onClick={clearSecondary}
                title="Remove comparison"
              >
                <X className="w-4 h-4" />
              </Button>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="font-serif text-lg italic">Compare with</span>
                  <span className="font-mono text-xs font-normal text-muted-foreground mr-8">
                    {secondaryInput.length} chars
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CodeEditor
                  value={secondaryInput}
                  onChange={setSecondaryInput}
                  placeholder={contentType === 'markdown' ? 'Paste markdown to compare...' : 'Paste JSON to compare...'}
                  minHeight="300px"
                  language={contentType as EditorLanguage}
                />
              </CardContent>
            </MotionCard>
          ) : (
            <MotionCard
              key="beautify-output"
              className="flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="font-serif text-lg italic">Output</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                      {displayedBeautifiedOutput.length} chars
                    </span>
                    {contentType === 'markdown' && (
                      <Tabs value={markdownOutputView} onValueChange={(v) => setMarkdownOutputView(v as MarkdownOutputView)}>
                        <TabsList className="h-8">
                          <TabsTrigger value="code" className="gap-1 px-2 py-1 text-xs h-6">
                            <Code className="w-3 h-3" />
                            Code
                          </TabsTrigger>
                          <TabsTrigger value="rendered" className="gap-1 px-2 py-1 text-xs h-6">
                            <Eye className="w-3 h-3" />
                            Preview
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={enableCompareMode}
                      className="text-xs"
                    >
                      <GitCompare className="w-3 h-3" />
                      Compare
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {contentType === 'markdown' && markdownOutputView === 'rendered' ? (
                  <div
                    className="markdown-preview rounded-md border bg-muted/30 overflow-auto p-6"
                    style={{ minHeight: 'calc(100vh - 480px)' }}
                  >
                    {displayedBeautifiedOutput ? (
                      <ReactMarkdown>{displayedBeautifiedOutput}</ReactMarkdown>
                    ) : (
                      <span className="text-muted-foreground">Rendered markdown will appear here...</span>
                    )}
                  </div>
                ) : (
                  <CodeEditor
                    value={displayedBeautifiedOutput}
                    readOnly
                    placeholder={contentType === 'markdown' ? 'Beautified markdown will appear here...' : 'Beautified JSON will appear here...'}
                    minHeight="calc(100vh - 480px)"
                    language={contentType as EditorLanguage}
                  />
                )}
              </CardContent>
            </MotionCard>
          )}
        </AnimatePresence>
      </div>

      {/* Diff result (only in compare mode) */}
      <AnimatePresence mode="wait">
        {diffResult && isCompareMode && (
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

export default JsonWorkspace
