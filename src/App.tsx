import { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import Fish from './components/Fish'
import { Leva } from 'leva'
import journalBg from './assets/journal.png'

const blendModes = [
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'difference',
  'exclusion', 'hard-light', 'soft-light'
]

const App = () => {
  const [blendMode, setBlendMode] = useState('exclusion')
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()  // Prevent default drag behavior
    setIsDragging(true)
    setStartY(e.clientY - dragY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()  // Prevent default drag behavior
      const newY = e.clientY - startY
      setDragY(Math.max(-window.innerHeight, Math.min(0, newY)))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div className="relative w-full min-h-[200vh] bg-black pointer-events-auto">
      {/* Blend Mode Selector */}
      <div className="fixed top-4 right-4 z-50 pointer-events-auto">
        <select
          value={blendMode}
          onChange={(e) => setBlendMode(e.target.value)}
          className="bg-black text-white border border-white rounded p-2"
        >
          {blendModes.map(mode => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
      </div>

      {/* Canvas container */}
      <div className="fixed inset-0 w-full h-screen pointer-events-none" style={{ zIndex: 1 }}>
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <Leva collapsed={true} />
          <Canvas
            className="w-full h-full"
            shadows
            gl={{
              alpha: true,
              antialias: true,
              premultipliedAlpha: false,
              stencil: false,
              depth: true,
            }}
            style={{ background: 'transparent' }}
          >
            <OrthographicCamera makeDefault position={[0, 50, 0]} rotation={[-Math.PI / 2, 0, 0]} zoom={50} near={0.1} far={1000} />

            {/* Reduce ambient light to make shadows more visible */}
            <ambientLight intensity={0.15} />

            {/* Enhance directional light for stronger shadows */}
            <directionalLight
              position={[5, 10, 5]}  // Moved closer for stronger shadows
              intensity={2}          // Increased intensity
              castShadow
              shadow-mapSize={[2048, 2048]}  // Increased shadow map resolution
              shadow-camera-left={-20}
              shadow-camera-right={20}
              shadow-camera-top={20}
              shadow-camera-bottom={-20}
              shadow-bias={-0.001}    // Reduce shadow acne
              shadow-darkness={1}     // Maximum shadow darkness
            />

            {/* Darker ground plane to increase contrast */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[100, 100]} />
              <meshStandardMaterial
                color="#202020"       // Darker color for better contrast
                roughness={1}         // Fully rough for better shadow visibility
                metalness={0}         // Non-metallic for better shadow contrast
              />
            </mesh>

            <Fish />
          </Canvas>
        </Suspense>
      </div>

      {/* Background image container */}
      <div
        className="fixed inset-0 w-full h-screen overflow-hidden"
        style={{
          zIndex: 2,
          isolation: 'isolate',
          mixBlendMode: blendMode,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >

        <img
          src={journalBg}
          alt="Journal background"
          className="absolute w-full max-h-[100vh] object-contain cursor-grab active:cursor-grabbing"
          style={{
            filter: `contrast(${1.6 + (dragY / window.innerHeight) * 0.1}) brightness(1.0)`,
            top: '80%',
            transform: `translateY(${dragY}px)`,
            userSelect: 'none',
            WebkitUserDrag: 'none',
            draggable: false,
          }}
          onDragStart={(e) => e.preventDefault()}
        />


      </div>

      {/* Scrollable content to enable scrolling */}
      <div className="w-full h-[200vh] pointer-events-auto" />
    </div>
  )
}

export default App
