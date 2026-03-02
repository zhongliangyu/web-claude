'use client'

import { useState, useRef, useEffect } from 'react'
import { CodeBlock } from './components/CodeBlock'

interface SSEEvent {
  event: 'thinking' | 'tool' | 'output' | 'error' | 'done'
  data: { content?: string; error?: string }
}

type ContentType = 'thinking' | 'tool' | 'output'

interface Content {
  type: ContentType
  content: string
}

export default function Page() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', contents: Content[] }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', contents: [{ type: 'output', content: userMessage }] }])

    // 添加助手消息容器
    setMessages(prev => [...prev, { role: 'assistant', contents: [] }])

    try {
      const response = await fetch('http://localhost:8002/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      let currentType: ContentType = 'output'
      let currentEventType: string = 'output'

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          // 跳过空行
          if (!line.trim()) continue

          // 解析事件类型
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim()
            continue
          }

          // 解析数据行
          if (line.startsWith('data: ')) {
            try {
              const data: SSEEvent['data'] = JSON.parse(line.slice(6).trim())

              if (currentEventType === 'done') {
                setLoading(false)
                break
              }

              if (currentEventType === 'thinking') {
                currentType = 'thinking'
              } else if (currentEventType === 'tool') {
                currentType = 'tool'
              } else if (currentEventType === 'output') {
                currentType = 'output'
              }

              if (currentEventType === 'error') {
                setMessages(prev => {
                  const newMsg = [...prev]
                  newMsg[newMsg.length - 1].contents.push({
                    type: 'output',
                    content: `❌ ${data.error}`
                })
                return newMsg
              })
              setLoading(false)
              break
            }

            if (event.data.content) {
              setMessages(prev => {
                const newMsg = [...prev]
                const lastMsg = newMsg[newMsg.length - 1]

                // 如果类型变化，添加新段落
                if (lastMsg.contents.length === 0 || lastMsg.contents[lastMsg.contents.length - 1].type !== currentType) {
                  lastMsg.contents.push({ type: currentType, content: event.data.content || '' })
                } else {
                  lastMsg.contents[lastMsg.contents.length - 1].content += event.data.content || ''
                }
                return newMsg
              })
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      setMessages(prev => {
        const newMsg = [...prev]
        newMsg[newMsg.length - 1].contents.push({
          type: 'output',
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
        return newMsg
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <header style={{ padding: '1rem 0', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>🤖 WebClaude</h1>
        <p style={{ color: 'var(--text-secondary)' }}>完整流式输出 · Thinking · 工具调用</p>
      </header>

      <div style={{ minHeight: 'calc(100vh - 250px)' }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {msg.role === 'user' ? '👤 你' : '🤖 Claude'}
            </div>
            {msg.contents.map((content, cIdx) => (
              <div key={cIdx}>
                {content.type === 'thinking' && (
                  <div className="thinking">
                    <small>Thinking</small>
                    <pre>{content.content}</pre>
                  </div>
                )}
                {content.type === 'tool' && (
                  <div className="tool">
                    <small>Tool Call</small>
                    <CodeBlock code={content.content} language="bash" />
                  </div>
                )}
                {content.type === 'output' && (
                  <div className="output">
                    <CodeBlock code={content.content} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div style={{ color: 'var(--text-secondary)' }}>🤖 Claude 正在思考...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? '发送中...' : '发送'}
        </button>
      </form>
    </div>
  )
}
