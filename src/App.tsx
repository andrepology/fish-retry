import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import Fish from './components/Fish'

const App = () => {
  return (
    <div className="w-screen h-screen bg-black">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <Canvas style={{ width: '100%', height: '100vh' }}>
          {/* Use an orthographic camera positioned overhead, looking down */}
          <OrthographicCamera makeDefault position={[0, 50, 0]} rotation={[-Math.PI / 2, 0, 0]} zoom={50} near={0.1} far={1000} />
          {/* Add a primitive AmbientLight */}
          <primitive object={new THREE.AmbientLight(0xffffff, 0.5)} />
          {/* Add a primitive PointLight */}
          <primitive object={new THREE.PointLight(0xffffff, 1)} position={[10, 10, 10]} />
          <Fish />
        </Canvas>
      </Suspense>
    </div>
  )
}

export default App
