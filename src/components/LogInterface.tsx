import { useState, useRef, useEffect } from 'react'

interface Thought {
  id: string
  content: string
  timestamp: string
}

interface LogInterfaceProps {
  className?: string
}

const LogInterface = ({ className = '' }: LogInterfaceProps) => {
  const [thoughts, setThoughts] = useState<Thought[]>([
    { id: 'wa7j', content: 'morning form, 3 avocado toasts. half a mate. there is, of course, another way of looking at this.', timestamp: '23m ago' },
    { id: '82fk', content: 'This is where the UX *is*, where it begins, typing, calmly and present. The past and future faded away.', timestamp: '4h ago' },
    { id: '9z3p', content: 'Woke up with some / more tingling. Made the mistake of going straight to the phone. Things settled after completing morning form. There is so much wisdom in it, doing the same thing daily.', timestamp: '4h ago' },
    { id: 'am7h', content: 'das', timestamp: '18:33' },
    { id: '6ud9', content: 'sa\n\n\n\nASDaa\n\n\n\nADS', timestamp: '18:33' },
    { id: '3e1', content: 'sad', timestamp: '18:33' },
    { id: 'xaq', content: 'sd', timestamp: '18:33' },
    { id: 'utgq', content: 'da', timestamp: '18:33' },
    { id: '7qype', content: 'asdas', timestamp: '18:33' },
    { id: '96h8', content: 'adasd', timestamp: '18:33' },
    { id: 'zlxi', content: 'saying I think the main takeaway here', timestamp: '18:32' },
    { id: 'zlc', content: 'I\'m so glad this exists', timestamp: '16:48' },
  ])
  
  const [newThought, setNewThought] = useState('')
  const [hoveredThoughtId, setHoveredThoughtId] = useState<string | null>(null)
  const [focusedThoughtId, setFocusedThoughtId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [journalPosition, setJournalPosition] = useState(400)
  const [isInputFocused, setIsInputFocused] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewThought(e.target.value)
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newThought.trim()) {
        addThought(newThought)
      }
    }
  }

  const addThought = (content: string) => {
    const id = Math.random().toString(36).substring(2, 6)
    const now = new Date()
    const timestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
    
    setThoughts(prev => [{ id, content, timestamp: 'just now' }, ...prev])
    setNewThought('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
    }
  }

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStartY(e.clientY - journalPosition)
    document.body.style.cursor = 'grabbing'
  }

  const handleDragMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newY = e.clientY - dragStartY
      setJournalPosition(newY)
    }
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    document.body.style.cursor = 'auto'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newY = e.clientY - dragStartY
        setJournalPosition(newY)
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        document.body.style.cursor = 'auto'
      }
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStartY])

  return (
    <div 
      ref={containerRef}
      className={`${className} text-white relative overflow-visible max-h-full  p-1`} 
      style={{ 
        zIndex: 10,
        transform: `translateY(${journalPosition}px)`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
      }}
    >
      <main>
        <div className="field relative mb-6 flex items-center">
          {/* Drag handle */}
          <div 
            className="drag-handle absolute scale-50 -left-10  top-0 w-10 h-10 flex items-center justify-center mr-2 cursor-grab active:cursor-grabbing group"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            <div 
              className="outer-circle  w-8 h-8 rounded-full bg-white/30 flex items-center justify-center transition-all duration-150"
              style={{ 
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(255,255,255,0.1)'
              }}
            >
              <div 
                className="inner-circle w-6 h-6 rounded-full bg-white/70 transition-all duration-150 group-hover:w-6 group-hover:h-6 group-active:w-7 group-active:h-7"
                style={{ 
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.3)'
                }}
              ></div>
            </div>
          </div>
          
          <div className="flex-grow relative bg-neutral-100/10 backdrop-blur-lg border border-neutral-100/5 p-1.5 pl-2.5 rounded-lg">
            <textarea 
              ref={textareaRef}
              rows={1} 
              className="w-full bg-transparent border-none text-white resize-none outline-none py-0.5 pr-8 placeholder:text-neutral-100/80"
              placeholder="What's on your mind?"
              spellCheck="false"
              value={newThought}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              style={{ 
                overflowY: 'hidden',
                height: '24px',
              }}
            />
            <button 
              className="mic absolute right-3 top-3 text-white/50 hover:text-white/80"
              tabIndex={-1}
              aria-label="Write by voice"
              title="Write by voice"
            >
              <svg fill="currentColor" viewBox="0 0 20 20" className="w-5 h-5">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"></path>
              </svg>
            </button>
          </div>
        </div>

        <hr className="border-white/20 my-4" />

        <ul className="thoughts space-y-4">
          {thoughts.map((thought, index) => (
            <li 
              key={thought.id} 
              className={`thought relative p-2 rounded-md transition-all duration-300 ${hoveredThoughtId === thought.id ? 'bg-white/10' : ''}`}
              onMouseEnter={() => setHoveredThoughtId(thought.id)}
              onMouseLeave={() => setHoveredThoughtId(null)}
              onClick={() => setFocusedThoughtId(thought.id === focusedThoughtId ? null : thought.id)}
            >
              <textarea 
                rows={1} 
                className="w-full bg-transparent border-none text-white resize-none outline-none pr-16 transition-all"
                placeholder="Erase with Backspace ⌫"
                spellCheck="false"
                value={thought.content}
                readOnly
                style={{ 
                  filter: focusedThoughtId === thought.id 
                    ? 'blur(0) opacity(1)' 
                    : hoveredThoughtId === thought.id 
                      ? 'blur(0px) opacity(0.6)' 
                      : isInputFocused
                        ? `blur(${Math.max(4, index * 4)}px) opacity(${Math.max(0.2, 0.8 - index * 0.05)})`
                        : 'blur(3px) opacity(0.7)',
                  overflowY: 'hidden',
                  height: `${Math.max(24, Math.min(24 * 9, (thought.content.split('\n').length * 24) || 48))}px`,
                  transitionProperty: 'filter, opacity',
                  transitionDuration: '400ms',
                  transitionDelay: isInputFocused ? `${index * 50}ms` : '0ms',
                }}
              />
              {hoveredThoughtId === thought.id && (
                <span className="timestamp absolute right-2 top-2 text-xs text-white/50 transition-opacity duration-200">
                  {thought.timestamp}
                </span>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

export default LogInterface 