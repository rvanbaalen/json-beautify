import { useState, useCallback } from 'react'
import { Github } from 'lucide-react'
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

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }

  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
      return sorted
    }, {} as Record<string, unknown>)
}

function App() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('standard')
  const [copied, setCopied] = useState(false)

  const beautifyJson = useCallback(() => {
    setError('')
    setOutput('')
    setCopied(false)

    if (!input.trim()) {
      setError('Please enter some JSON to beautify')
      return
    }

    try {
      let parsed = JSON.parse(input)
      const preset = presets[selectedPreset]

      if (preset.sortKeys) {
        parsed = sortObjectKeys(parsed)
      }

      const indent = preset.indent === 0 ? undefined : preset.indent
      const formatted = JSON.stringify(parsed, null, indent)
      setOutput(formatted)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }, [input, selectedPreset])

  const copyToClipboard = useCallback(async () => {
    if (output) {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [output])

  const clearAll = useCallback(() => {
    setInput('')
    setOutput('')
    setError('')
    setCopied(false)
  }, [])

  const loadSample = useCallback(() => {
    const sample = {
      name: 'JSON Beautifier',
      version: '1.0.0',
      features: ['Format JSON', 'Multiple presets', 'Sort keys', 'Copy to clipboard'],
      config: {
        theme: 'light',
        autoFormat: false,
        settings: {
          indentation: 2,
          sortKeys: false,
        },
      },
      data: [1, 2, 3, { nested: true }],
    }
    setInput(JSON.stringify(sample))
    setOutput('')
    setError('')
  }, [])

  return (
    <div className="relative min-h-screen bg-background p-4 md:p-8">
      <a
        href="https://github.com/rvanbaalen/json-beautify"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="View source on GitHub"
      >
        <Github className="h-6 w-6" />
      </a>
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">JSON Beautifier</h1>
          <p className="mt-2 text-muted-foreground">
            Paste your JSON, select a preset, and beautify!
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="preset" className="whitespace-nowrap">
              Format Preset:
            </Label>
            <Select value={selectedPreset} onValueChange={setSelectedPreset}>
              <SelectTrigger id="preset" className="w-[200px]">
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
          </div>

          <Separator orientation="vertical" className="hidden h-8 md:block" />

          <div className="flex gap-2">
            <Button onClick={beautifyJson} size="lg">
              Beautify
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
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Input</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {input.length} characters
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste your JSON here..."
                className="min-h-[400px] font-mono text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Output</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-normal text-muted-foreground">
                    {output.length} characters
                  </span>
                  {output && (
                    <Button size="sm" variant="outline" onClick={copyToClipboard}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Beautified JSON will appear here..."
                className="min-h-[400px] font-mono text-sm"
                value={output}
                readOnly
              />
            </CardContent>
          </Card>
        </div>

        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            All processing happens in your browser. No data is sent to any server.
          </p>
          <p className="mt-2">
            Made by{' '}
            <a
              href="https://robinvanbaalen.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-foreground"
            >
              Robin van Baalen
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
