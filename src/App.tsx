import { Suspense } from 'react'
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import Fish from "./components/Fish"

const App = () => {
  return (
    <div className="w-screen h-screen bg-black">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <Canvas style={{ width: '100%', height: '100vh' }} camera={{ position: [0, 0, 10], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <Fish />
          <OrbitControls />
        </Canvas>
      </Suspense>
    </div>
  )
}

export default App
