import { Suspense, useState, useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrthographicCamera, Stats, CameraControls } from '@react-three/drei'
import Fish from './components/Fish'
import { useControls } from 'leva'
import journalBg from './assets/journal.png'
import * as THREE from 'three'
import Starfield from './components/Starfield'

const blendModes = [
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'difference',
  'exclusion', 'hard-light', 'soft-light'
] as const

type BlendMode = typeof blendModes[number]

// Create a camera controller component
const CameraController = ({ target }: { target: THREE.Vector3 }) => {
  const controlsRef = useRef<CameraControls>(null)

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.setLookAt(
        target.x,
        target.y + 20,
        target.z + 10,
        target.x,
        target.y,
        target.z,
        true // enable smooth transitions
      )
    }
  })

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={10}
      maxDistance={50}
      dampingFactor={0.05} // Reduced for smoother movement
      enabled={true}
    />
  )
}

const App = () => {
  const [blendMode, setBlendMode] = useState<BlendMode>('exclusion')
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [fishPosition, setFishPosition] = useState(new THREE.Vector3(0, 0, 0))
  
  // Add the ref for CameraControls
  const controlsRef = useRef<CameraControls>(null)

  // Add Leva controls for lighting and camera
  const { 
    ambientIntensity,
    directionalIntensity,
    lightPosition,
    shadowMapSize,
    shadowBias,
    shadowCameraSize,
    cameraPosition,
    cameraZoom,
    cameraNear,
    cameraFar
  } = useControls({
    // Lighting controls
    ambientIntensity: { value: 0.15, min: 0, max: 1, step: 0.01 },
    directionalIntensity: { value: 2, min: 0, max: 5, step: 0.1 },
    lightPosition: { 
      value: [5, 10, 5],
      step: 1,
    },
    shadowMapSize: { value: 2048, min: 512, max: 4096, step: 512 },
    shadowBias: { value: -0.0001, min: -0.01, max: 0.01, step: 0.0001 },
    shadowCameraSize: { value: 20, min: 1, max: 50, step: 1 },
    
    // Camera controls
    cameraPosition: {
      value: [0, 50, 0],
      step: 1,
    },
    cameraZoom: { value: 50, min: 10, max: 100, step: 1 },
    cameraNear: { value: 0.1, min: 0.1, max: 10, step: 0.1 },
    cameraFar: { value: 1000, min: 100, max: 2000, step: 100 }
  })

  // Add Starfield controls
  const starfieldControls = useControls('Starfield', {
    density: { value: 400, min: 100, max: 1000, step: 100 },
    depth: { value: 70, min: 10, max: 200, step: 10 },
    minSize: { value: 0.05, min: 0.05, max: 0.5, step: 0.05 },
    maxSize: { value: 0.10, min: 0.1, max: 1, step: 0.05 },
    speed: { value: 0.025, min: 0, max: 0.1, step: 0.01 },
    twinkleSpeed: { value: 1.0, min: 0.1, max: 2, step: 0.1 },
    twinkleAmount: { value: 0.6, min: 0, max: 1, step: 0.1 },
  })

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setStartY(e.clientY - dragY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      const newY = e.clientY - startY
      setDragY(Math.max(-window.innerHeight, Math.min(0, newY)))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div className="relative w-full h-screen pointer-events-auto">
      {/* Blend Mode Selector */}
      <div className="fixed top-4 right-4 z-50 pointer-events-auto">
        <select
          value={blendMode}
          onChange={(e) => setBlendMode(e.target.value as BlendMode)}
          className="bg-black text-white border border-white rounded p-2"
        >
          {blendModes.map(mode => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
      </div>

      {/* Canvas container */}
      <div className="fixed inset-0 w-full h-screen" style={{ zIndex: 1 }}>
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <Canvas
            className="w-full h-full"
            shadows
            style={{ background: 'black' }}
          >
            {/* Add Starfield before other scene elements */}
            <Starfield
              density={starfieldControls.density}
              depth={starfieldControls.depth}
              size={{ min: starfieldControls.minSize, max: starfieldControls.maxSize }}
              speed={starfieldControls.speed}
              twinkleSpeed={starfieldControls.twinkleSpeed}
              twinkleAmount={starfieldControls.twinkleAmount}
            />

            <OrthographicCamera 
              makeDefault 
              position={cameraPosition} 
              rotation={[-Math.PI / 2, 0, 0]} 
              zoom={cameraZoom}
              near={cameraNear}
              far={cameraFar}
            />

            <CameraController target={fishPosition} />

            <group>
              <ambientLight intensity={ambientIntensity} />
              <directionalLight
                position={lightPosition}
                intensity={directionalIntensity}
                castShadow
                shadow-mapSize-width={shadowMapSize}
                shadow-mapSize-height={shadowMapSize}
                shadow-camera-left={-shadowCameraSize}
                shadow-camera-right={shadowCameraSize}
                shadow-camera-top={shadowCameraSize}
                shadow-camera-bottom={-shadowCameraSize}
                shadow-camera-near={0.1}
                shadow-camera-far={100}
                shadow-bias={shadowBias}
              />
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.5, 0]}>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial
                  color="#202020"
                  roughness={0.2 }
                  metalness={0}
                />
              </mesh>
            </group>

            {/* Pass the fish position to update our fishPosition state */}
            <Fish onPositionUpdate={setFishPosition} />
            {/* Stats panel for real-time performance measurement */}
            <Stats />
          </Canvas>
        </Suspense>
      </div>

      {/* Background image container */}
      <div
        className="fixed inset-0 w-full h-screen overflow-hidden pointer-events-none"
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
          className="absolute w-full max-h-[100vh] object-contain cursor-grab active:cursor-grabbing pointer-events-auto"
          style={{
            filter: `contrast(${1.6 + (dragY / window.innerHeight) * 0.1}) brightness(1.0)`,
            top: '80%',
            transform: `translateY(${dragY}px)`,
            userSelect: 'none',
            WebkitUserDrag: 'none' as any,
            draggable: false,
          }}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
    </div>
  )
}

export default App
