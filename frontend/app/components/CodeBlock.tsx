'use client'

import { useEffect, useRef, useState } from 'react'

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  // 检测代码语言（简单规则）
  const detectLanguage = (code: string): string => {
    if (code.includes('```')) {
      const match = code.match(/```(\w+)?/)
      return match?.[1] || 'text'
    }
    if (code.startsWith('import ') || code.includes('function ') || code.includes('class ')) return 'typescript'
    if (code.includes('def ') || code.includes('import ')) return 'python'
    if (code.includes('npm run') || code.includes('package.json')) return 'bash'
    return language
  }

  const detectedLang = detectLanguage(code)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.replace(/```\w*?\n?/g, '').replace(/```\n?/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 提取纯代码（移除 markdown 代码块标记）
  const extractCode = (text: string): string => {
    return text.replace(/```\w*?\n?/g, '').replace(/```\n?/g, '')
  }

  const cleanCode = extractCode(code)
  const isCodeBlock = code.includes('```') || code.includes('import ') || /[{}\[\]]/.test(cleanCode)

  if (!isCodeBlock) {
    return <div className="message-content">{code}</div>
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          opacity: copied ? 1 : 0.7,
        }}
      >
        {copied ? '✓ 已复制' : '复制'}
      </button>
      <pre ref={ref}>
        <code className={`language-${detectedLang}`}>{cleanCode}</code>
      </pre>
    </div>
  )
}
