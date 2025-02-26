import { useState, useRef, useEffect, useMemo } from 'react'
import { useInputClassification, InputType } from '../hooks/useInputClassification'
import { useSpeechInteraction } from '../hooks/useSpeechInteraction'

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
  const [typingTimeout, setTypingTimeout] = useState<number | null>(null)
  
  const { inputType, isClassifying, classifyInput } = useInputClassification()
  const { isRecording, userSpeech, fishResponse, startRecording, stopRecording } = useSpeechInteraction()
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNewThought(value)
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
    
    // Debounced classification
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }
    
    setTypingTimeout(setTimeout(() => {
      classifyInput(value)
    }, 500))
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

  useEffect(() => {
    if (userSpeech) {
      setNewThought(userSpeech)
      
      // Auto-resize textarea after setting speech content
      if (textareaRef.current) {
        textareaRef.current.style.height = '24px'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    }
  }, [userSpeech])

  const getPlaceholderText = () => {
    switch (inputType) {
      case 'SEARCH':
        return 'Search BlueSky...'
      case 'POST':
        return 'What\'s on your mind?'
      default:
        return 'do, reflect, repeat, become'
    }
  }
  
  const getBorderRadius = () => {
    switch (inputType) {
      case 'SEARCH':
        return '1.5rem'
      case 'POST':
        return '0.75rem'
      default:
        return '0.5rem'
    }
  }
  
  const handleActionClick = () => {
    switch (inputType) {
      case 'SEARCH':
        console.log('Searching BlueSky for:', newThought)
        // Implement search functionality
        break
      case 'POST':
        console.log('Posting to BlueSky:', newThought)
        addThought(newThought)
        break
      default:
        // Start/stop recording with mic
        if (isRecording) {
          stopRecording()
        } else {
          startRecording()
        }
        break
    }
  }

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
        <div className="field relative mb-6">
          {/* Profile circle for POST state - absolutely positioned above input */}
          {inputType === 'POST' && (
            <div 
              className="flex items-center animate-fadeIn absolute -top-6 left-1.5"
              style={{
                opacity: isInputFocused ? '1' : '0.7',
                transition: 'opacity 0.3s ease',
              }}
            >
              <div className="w-5 h-5 rounded-full bg-neutral-100/10 flex items-center justify-center mr-1.5 shadow-sm">
                <svg className="w-2.5 h-2.5 text-neutral-100/90" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                </svg>
              </div>
              <span className="text-[10px] text-neutral-100/70 font-semibold whitespace-nowrap">@andrepology.bsky.social</span>
            </div>
          )}
          
          {/* Drag handle */}
          <div 
            className="drag-handle absolute scale-50 -left-10  top-0 w-10 h-10 flex items-center justify-center mr-2 cursor-grab active:cursor-grabbing group"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            style={{
              opacity: isInputFocused ? '0' : '1',
              transition: 'opacity 300ms ease-out',
              pointerEvents: isInputFocused ? 'none' : 'auto'
            }}
          >
            <div 
              className="outer-circle  w-8 h-8 rounded-full bg-white/20 flex items-center justify-center transition-all duration-150"
              style={{ 
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 2px rgba(255,255,255,0.1)'
              }}
            >
              <div 
                className="inner-circle w-6 h-6 rounded-full bg-white/70 transition-all duration-150 group-hover:w-6 group-hover:h-6 group-active:w-7 group-active:h-7"
                style={{ 
                  //boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.3)'
                }}
              ></div>
            </div>
          </div>
          
          <div 
            className={`flex-grow relative bg-neutral-100/10 backdrop-blur-lg border border-neutral-100/5 p-1.5 pl-4 rounded-lg transition-all duration-300`}
            style={{
              transform: isInputFocused ? 'translate(-1px, -1px)' : 'translate(0, 0)',
              boxShadow: isInputFocused 
                ? inputType === 'POST'
                  ? '0 0 20px rgba(16, 185, 129, 0.15), 3px 3px 15px rgba(0, 0, 0, 0.1)'
                  : inputType === 'SEARCH'
                    ? '0 0 20px rgba(59, 130, 246, 0.15), 3px 3px 15px rgba(0, 0, 0, 0.1)'
                    : '3px 3px 15px rgba(0, 0, 0, 0.1)'
                : 'none',
              borderRadius: getBorderRadius(),
              transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-radius 0.3s ease',
              borderColor: inputType === 'SEARCH' 
                ? 'rgba(59, 130, 246, 0.3)' 
                : inputType === 'POST' 
                  ? 'rgba(16, 185, 129, 0.3)' 
                  : 'rgba(255, 255, 255, 0.05)'
            }}
          >
            {isClassifying && (
              <div className="absolute left-0 top-0 h-0.5 bg-white/20 animate-pulse rounded-full" style={{
                width: '100%',
                animation: 'pulseWidth 1s infinite'
              }}></div>
            )}
            <textarea 
              ref={textareaRef}
              rows={1} 
              className="w-full bg-transparent border-none text-white resize-none outline-none py-0.5 pr-8 placeholder:text-neutral-100/80"
              placeholder={getPlaceholderText()}
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
              className="action-button absolute right-3 top-2.5 text-white/50 hover:text-white/80 transition-all duration-300"
              tabIndex={-1}
              aria-label={inputType === 'SEARCH' ? "Search" : inputType === 'POST' ? "Post" : "Write by voice"}
              title={inputType === 'SEARCH' ? "Search" : inputType === 'POST' ? "Post" : "Write by voice"}
              onClick={handleActionClick}
              style={{
                opacity: isClassifying ? '0.5' : '1',
                color: inputType === 'SEARCH' 
                  ? 'rgba(59, 130, 246, 0.8)' 
                  : inputType === 'POST' 
                    ? 'rgba(16, 185, 129, 0.8)' 
                    : isRecording ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.5)'
              }}
            >
              {inputType === 'SEARCH' && (
                <svg fill="currentColor" viewBox="0 0 20 20" className="w-5 h-5 transform scale-100 transition-all duration-300">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                </svg>
              )}
              {inputType === 'POST' && (
                <svg fill="currentColor" viewBox="0 0 20 20" className="w-5 h-5 transform scale-100 transition-all duration-300">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
              )}
              {inputType === 'ENTRY' && (
                <svg fill="currentColor" viewBox="0 0 20 20" className={`w-5 h-5 transform scale-100 transition-all duration-300 ${isRecording ? 'text-red-500 animate-pulse' : ''}`}>
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd"></path>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* BlueSky post options - moved outside the input bar */}
        {inputType === 'POST' && (
          <div className="flex items-center space-x-2 mb-4 ml-1 animate-fadeIn">
            <button className="text-green-300/60 hover:text-green-300/90 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </button>
            <button className="text-green-300/60 hover:text-green-300/90 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z" clipRule="evenodd" />
              </svg>
            </button>
            <button className="text-green-300/60 hover:text-green-300/90 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </button>
            <span className="text-xs text-green-300/60 ml-auto">Public</span>
          </div>
        )}

        <hr className="border-white/20 my-4" />

        {inputType === 'SEARCH' && (
          <div className="search-info text-center py-8 animate-fadeIn">
            <div className="text-blue-300/70 mb-2">
              <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
              </svg>
              <h3 className="text-lg font-medium">Searching BlueSky</h3>
            </div>
            <p className="text-white/50 text-sm max-w-sm mx-auto">
            </p>
          </div>
        )}

        <ul className="thoughts space-y-4" style={{
          opacity: inputType === 'SEARCH' ? '0' : '1',
          transition: 'opacity 0.5s ease',
          pointerEvents: inputType === 'SEARCH' ? 'none' : 'auto'
        }}>
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
                  transitionDelay: isInputFocused ? `${index * 20}ms` : '0ms',
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