import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { useTheme } from '@/components/theme-provider'
import { useMemo, useEffect, useState } from 'react'

export type EditorLanguage = 'json' | 'markdown'

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
  minHeight?: string
  language?: EditorLanguage
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  className = '',
  minHeight = '400px',
  language = 'json',
}: CodeEditorProps) {
  const { theme } = useTheme()
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const editorTheme = useMemo(() => {
    const effectiveTheme = theme === 'system' ? systemTheme : theme
    return effectiveTheme === 'dark' ? githubDark : githubLight
  }, [theme, systemTheme])

  const languageExtension = useMemo(() => {
    return language === 'markdown' ? markdown() : json()
  }, [language])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={editorTheme}
      extensions={[languageExtension]}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`rounded-md border overflow-hidden ${className}`}
      minHeight={minHeight}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: true,
      }}
    />
  )
}
