import { useEffect } from 'react'

interface GitHubCornerProps {
  href: string
}

declare global {
  interface Window {
    GitHubButtons?: {
      render: () => void
    }
  }
}

export function GitHubCorner({ href }: GitHubCornerProps) {
  useEffect(() => {
    // Load the GitHub buttons script
    const existingScript = document.querySelector(
      'script[src="https://buttons.github.io/buttons.js"]'
    )

    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://buttons.github.io/buttons.js'
      script.async = true
      script.defer = true
      document.body.appendChild(script)
    } else if (window.GitHubButtons) {
      // Re-render if script already loaded
      window.GitHubButtons.render()
    }
  }, [])

  return (
    <div className="fixed right-4 top-4 z-50">
      <a
        className="github-button"
        href={href}
        data-color-scheme="no-preference: light; light: light; dark: dark;"
        data-size="large"
        data-show-count="true"
        aria-label="Star rvanbaalen/json-beautify on GitHub"
      >
        Star
      </a>
    </div>
  )
}
