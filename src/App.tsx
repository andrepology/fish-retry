import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import Fish from './components/Fish'
import { Leva } from 'leva'

const App = () => {
  return (
    <div className="w-screen h-screenk">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <Leva collapsed={true} />
        <Canvas style={{ width: '100%', height: '100vh' }} shadows>
          {/* Use an orthographic camera positioned overhead, looking down */}
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
  )
}

export default App
