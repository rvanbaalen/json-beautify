import { motion } from 'motion/react'
import { ModeToggle } from '@/components/mode-toggle'
import { GitHubCorner } from '@/components/github-corner'
import { JsonWorkspace } from '@/components/JsonWorkspace'

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <GitHubCorner href="https://github.com/rvanbaalen/json-beautify" />

      <div className="flex-1 p-4 md:p-8">
        <div className="mx-auto flex h-full max-w-7xl flex-col">
          <motion.header
            className="mb-8 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 flex items-center justify-center gap-4">
              <h1 className="font-serif text-4xl tracking-tight text-foreground md:text-5xl">
                JSON <span className="italic text-primary">Beautifier</span>
              </h1>
              <ModeToggle />
            </div>
            <p className="text-muted-foreground">
              Format, beautify, and compare your JSON data
            </p>
          </motion.header>

          <JsonWorkspace />

          <motion.footer
            className="mt-8 text-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <p>
              All processing happens in your browser. No data is sent to any server.
            </p>
            <p className="mt-2">made by Robin.</p>
          </motion.footer>
        </div>
      </div>
    </div>
  )
}

export default App
