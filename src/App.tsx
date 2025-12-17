import { useState, useCallback } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import JsonDiff from '@/components/JsonDiff'
import { ModeToggle } from '@/components/mode-toggle'
import { GitHubCorner } from '@/components/github-corner'
import { CodeEditor } from '@/components/code-editor'

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
    <div className="flex min-h-screen flex-col bg-background">
      <GitHubCorner href="https://github.com/rvanbaalen/json-beautify" />

      <div className="flex-1 p-4 md:p-8">
        <div className="mx-auto flex h-full max-w-7xl flex-col">
          <header className="mb-6 text-center">
            <div className="mb-4 flex items-center justify-center gap-4">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">JSON Beautifier</h1>
              <ModeToggle />
            </div>
            <p className="text-muted-foreground">
              Format, beautify, and compare your JSON data
            </p>
          </header>

          <Tabs defaultValue="beautify" className="flex flex-1 flex-col">
            <TabsList className="mx-auto">
              <TabsTrigger value="beautify">Beautify</TabsTrigger>
              <TabsTrigger value="diff">Compare / Diff</TabsTrigger>
            </TabsList>

            <TabsContent value="beautify" className="mt-6 flex flex-1 flex-col space-y-6">
              <div className="flex flex-wrap items-center justify-center gap-4">
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
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                  {error}
                </div>
              )}

              <div className="grid flex-1 gap-6 md:grid-cols-2">
                <Card className="flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span>Input</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {input.length} characters
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <CodeEditor
                      value={input}
                      onChange={setInput}
                      placeholder="Paste your JSON here..."
                      minHeight="calc(100vh - 420px)"
                    />
                  </CardContent>
                </Card>

                <Card className="flex flex-col">
                  <CardHeader className="pb-3">
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
                  <CardContent className="flex-1">
                    <CodeEditor
                      value={output}
                      readOnly
                      placeholder="Beautified JSON will appear here..."
                      minHeight="calc(100vh - 420px)"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="diff" className="mt-6 flex-1">
              <JsonDiff />
            </TabsContent>
          </Tabs>

          <footer className="mt-6 text-center text-sm text-muted-foreground">
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
    </div>
  )
}

export default App
