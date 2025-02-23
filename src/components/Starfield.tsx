import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface StarfieldProps {
  density?: number // stars per unit area (default: 100)
  depth?: number // z-depth range for parallax (default: 50)
  size?: { min: number; max: number } // star size range (default: 0.1 to 0.5)
  speed?: number // parallax movement speed (default: 0.02)
  twinkleSpeed?: number // how fast stars twinkle (default: 0.8)
  twinkleAmount?: number // intensity of twinkling (default: 0.4)
}

const Starfield: React.FC<StarfieldProps> = ({
  density = 10,
  depth = 50,
  size = { min: 0.1, max: 0.5 },
  speed = 0.02,
  twinkleSpeed = 0.8,
  twinkleAmount = 0.4,
}) => {
  const points = useRef<THREE.Points>(null)

  // Generate random star positions and sizes
  const [positions, scales, randomOffsets] = useMemo(() => {
    const positions = new Float32Array(density * 3)
    const scales = new Float32Array(density)
    const randomOffsets = new Float32Array(density)

    for (let i = 0; i < density; i++) {
      // Distribute stars in a cylinder shape around the camera
      // Increase minimum radius to 40 and maximum to 100
      const radius = Math.random() * 20
      const theta = Math.random() * Math.PI * 2
      // Adjust z-depth to be further away
      const z = (Math.random() * depth - depth / 2)  - 20 // Offset by -50 to push stars back

      positions[i * 3] = Math.cos(theta) * radius
      positions[i * 3 + 1] = Math.sin(theta) * radius
      positions[i * 3 + 2] = z

      scales[i] = Math.random() * (size.max - size.min) + size.min
      randomOffsets[i] = Math.random() * Math.PI * 2
    }

    return [positions, scales, randomOffsets]
  }, [density, depth, size.min, size.max])

  // Create geometries and materials
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('scale', new THREE.Float32BufferAttribute(scales, 1))
    geometry.setAttribute('randomOffset', new THREE.Float32BufferAttribute(randomOffsets, 1))
    return geometry
  }, [positions, scales, randomOffsets])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        twinkleSpeed: { value: twinkleSpeed },
        twinkleAmount: { value: twinkleAmount },
      },
      vertexShader: `
        attribute float scale;
        attribute float randomOffset;
        uniform float time;
        uniform float twinkleSpeed;
        uniform float twinkleAmount;
        
        varying float vBrightness;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float twinkle = sin(time * twinkleSpeed + randomOffset) * 0.5 + 0.5;
          vBrightness = 1.0 - (twinkle * twinkleAmount);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = scale * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying float vBrightness;
        
        void main() {
          gl_FragColor = vec4(vec3(vBrightness), 1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  }, [twinkleSpeed, twinkleAmount])

  // Animation
  useFrame((state) => {
    if (!points.current) return

    // Update time uniform for twinkling
    material.uniforms.time.value = state.clock.getElapsedTime()

    // Parallax effect based on camera movement
    points.current.rotation.y = state.camera.position.x * speed
    points.current.rotation.x = state.camera.position.z * speed
  })

  return <points ref={points} geometry={geometry} material={material} />
}

export default Starfield 