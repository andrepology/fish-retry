// @ts-nocheck
import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, RootState, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

type Behavior = 'rest' | 'follow' | 'approach' | 'wander'

const Fish: React.FC = () => {
  // Increase number of tail segments for more fish-like shape
  const numSegments = 8

  const { mouse, camera } = useThree()
  const headRef = useRef<THREE.Mesh>(null)
  const prevHeadPos = useRef(new THREE.Vector3())
  const velocityRef = useRef(new THREE.Vector3())
  const arrowRef = useRef(null)
  const wanderTargetRef = useRef(new THREE.Vector3())
  const lastWanderUpdateRef = useRef(0)

  const [behavior, setBehavior] = useState<Behavior>('rest')
  const [restTarget, setRestTarget] = useState(new THREE.Vector3(0, 0, 0))
  const [restDirection, setRestDirection] = useState(new THREE.Vector3(0, 0, 1))
  const [approachTarget, setApproachTarget] = useState(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        setBehavior('rest')
        if (headRef.current) {
          setRestTarget(headRef.current.position.clone())
          // Store current direction or default to forward
          if (velocityRef.current.length() > 0.001) {
            setRestDirection(velocityRef.current.clone().normalize())
          } else {
            setRestDirection(new THREE.Vector3(0, 0, 1))
          }
        }
      } else if (event.key.toLowerCase() === 'f') {
        setBehavior('follow')
      } else if (event.key.toLowerCase() === 'a') {
        setBehavior('approach')
      } else if (event.key.toLowerCase() === 'w') {
        setBehavior('wander')
        if(headRef.current){
          // Initialize wander target as the current head position
          wanderTargetRef.current.copy(headRef.current.position);
          lastWanderUpdateRef.current = 0;
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const tailPositions = useMemo(() => {
    const arr: THREE.Vector3[] = []
    for (let i = 0; i < numSegments; i++) {
      arr.push(new THREE.Vector3(0, -(i + 1) * 0.5, 0))
    }
    return arr
  }, [numSegments])

  const tailRefs = useRef<(THREE.Mesh | null)[]>([])
  tailRefs.current = new Array(numSegments).fill(null)

  useEffect(() => {
    if (headRef.current) {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        headRef.current.position,
        2,
        0x00ffff
      )
      arrowRef.current = arrow
      headRef.current.parent?.add(arrow)
    }
  }, [])

  useFrame((state: RootState, delta: number) => {
    if (!headRef.current) return

    const time = state.clock.elapsedTime
    let currentTarget = new THREE.Vector3()
    const spacing = 0.5  // Constant spacing between segments

    // Motion parameters
    const swayFreq = 1.0
    const bobFreq = 1.2
    const swayAmplitude = 0.1
    const bobAmplitude = 0.3

    if (behavior === 'rest') {
      // Calculate head motion first
      const headSway = Math.sin(time * swayFreq) * swayAmplitude
      const headBob = Math.sin(time * bobFreq) * bobAmplitude

      // Apply to head position
      const perpSway = new THREE.Vector3(-restDirection.z, 0, restDirection.x)
      currentTarget.copy(restTarget)
        .add(perpSway.multiplyScalar(headSway))
        .add(new THREE.Vector3(0, headBob, 0))
      
      // Update head position with the new motion
      headRef.current.position.lerp(currentTarget, 0.1)
    } else if (behavior === 'follow') {
      // Compute target from mouse pointer on XZ plane
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const followTargetCursor = new THREE.Vector3()
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      raycaster.ray.intersectPlane(plane, followTargetCursor)
      followTargetCursor.y = 0
      currentTarget.copy(followTargetCursor)
      headRef.current.position.lerp(currentTarget, 0.02)
    } else if (behavior === 'wander') {
      const wanderParams = {
        visionDistance: 5,      // How far ahead the fish can "see"
        forwardDistance: 2.5,   // How far ahead to place the actual target
        radius: 1,
        updateInterval: 0.8,
        arrivalThreshold: 0.3,
        bounds: { min: -20, max: 20 },
        lerpSpeed: 0.01,
        boundaryBuffer: 3       // Start avoiding when this far from bounds
      }

      // Ensure fish stays within bounds
      const currentPos = headRef.current.position.clone()
      currentPos.x = THREE.MathUtils.clamp(
        currentPos.x,
        wanderParams.bounds.min,
        wanderParams.bounds.max
      )
      currentPos.z = THREE.MathUtils.clamp(
        currentPos.z,
        wanderParams.bounds.min,
        wanderParams.bounds.max
      )
      headRef.current.position.copy(currentPos)

      // Get current forward direction (ensure it's on XZ plane)
      const forward = new THREE.Vector3()
      if (velocityRef.current.length() > 0.001) {
        forward.copy(velocityRef.current)
        forward.y = 0  // Force to XZ plane
        forward.normalize()
      } else {
        forward.copy(restDirection)
      }

      // Check vision point for obstacles
      const visionPoint = currentPos.clone().add(forward.clone().multiplyScalar(wanderParams.visionDistance))
      const isVisionPointOutOfBounds = 
        visionPoint.x < wanderParams.bounds.min + wanderParams.boundaryBuffer ||
        visionPoint.x > wanderParams.bounds.max - wanderParams.boundaryBuffer ||
        visionPoint.z < wanderParams.bounds.min + wanderParams.boundaryBuffer ||
        visionPoint.z > wanderParams.bounds.max - wanderParams.boundaryBuffer

      // Check if current target is out of bounds
      const isTargetOutOfBounds = 
        wanderTargetRef.current.x < wanderParams.bounds.min ||
        wanderTargetRef.current.x > wanderParams.bounds.max ||
        wanderTargetRef.current.z < wanderParams.bounds.min ||
        wanderTargetRef.current.z > wanderParams.bounds.max

      const shouldUpdateTarget = 
        time - lastWanderUpdateRef.current > wanderParams.updateInterval || 
        headRef.current.position.distanceTo(wanderTargetRef.current) < wanderParams.arrivalThreshold ||
        isTargetOutOfBounds ||
        isVisionPointOutOfBounds

      if (shouldUpdateTarget) {
        let targetBase
        if (isVisionPointOutOfBounds) {
          // Calculate direction to center when obstacle detected
          const toCenter = new THREE.Vector3(0, 0, 0).sub(currentPos).normalize()
          targetBase = currentPos.clone()
          targetBase.add(toCenter.multiplyScalar(wanderParams.forwardDistance))
        } else {
          // Normal forward-based targeting
          targetBase = currentPos.clone()
          targetBase.add(forward.multiplyScalar(wanderParams.forwardDistance))
        }

        // Calculate random offset within radius (on XZ plane)
        const angle = Math.random() * Math.PI * 2
        const offsetLength = Math.random() * wanderParams.radius
        const offset = new THREE.Vector3(
          Math.cos(angle),
          0,
          Math.sin(angle)
        ).multiplyScalar(offsetLength)

        // Apply offset and clamp to bounds
        const newTarget = targetBase.clone().add(offset)
        newTarget.x = THREE.MathUtils.clamp(
          newTarget.x,
          wanderParams.bounds.min,
          wanderParams.bounds.max
        )
        newTarget.z = THREE.MathUtils.clamp(
          newTarget.z,
          wanderParams.bounds.min,
          wanderParams.bounds.max
        )
        newTarget.y = 0

        wanderTargetRef.current.copy(newTarget)
        lastWanderUpdateRef.current = time
      }

      currentTarget.copy(wanderTargetRef.current)
      currentTarget.y = 0
      headRef.current.position.lerp(currentTarget, wanderParams.lerpSpeed)
    } else if (behavior === 'approach') {
      currentTarget.copy(approachTarget)
      currentTarget.y = 0
      headRef.current.position.lerp(currentTarget, 0.02)
    }

    // Update velocity
    velocityRef.current.copy(headRef.current.position).sub(prevHeadPos.current)
    prevHeadPos.current.copy(headRef.current.position)

    // Compute head direction
    const headDir = new THREE.Vector3()
    if (behavior === 'rest') {
      headDir.copy(restDirection)
    } else if (velocityRef.current.length() > 0.001) {
      headDir.copy(velocityRef.current).normalize()
    } else {
      headDir.set(0, 0, 1)
    }

    // Update debug arrow
    if (arrowRef.current) {
      arrowRef.current.position.copy(headRef.current.position)
      arrowRef.current.setDirection(headDir)
    }

    // Update tail segments for all behaviors
    let prevPos = headRef.current.position.clone()
    for (let i = 0; i < numSegments; i++) {
      // Base position with spacing
      const basePos = new THREE.Vector3()
        .copy(prevPos)
        .addScaledVector(headDir, -spacing)

      if (behavior === 'rest') {
        // Add downward droop in rest mode
        const droopAmount = 0.15 * (i / numSegments) ** 2
        basePos.y -= droopAmount

        // Add attenuated motion
        const swayPhase = i * 0.2
        const bobPhase = i * 0.15
        const attenuation = 1 - i / (numSegments * 1.5)
        
        const sway = Math.sin(time * swayFreq + swayPhase) * (swayAmplitude * attenuation)
        const bob = Math.sin(time * bobFreq + bobPhase) * (bobAmplitude * attenuation)

        // Compute perpendicular vector for sway
        const perpSway = new THREE.Vector3(-headDir.z, 0, headDir.x)
        
        // Apply motions
        basePos.add(perpSway.multiplyScalar(sway))
        basePos.y += bob
      } else {
        // In follow/approach/wander modes, add wave motion based on speed
        const speedFactor = THREE.MathUtils.clamp(velocityRef.current.length() * 10, 0.2, 1)
        const baseAmplitude = 0.2 * (1 - i / numSegments)
        const waveAmplitude = baseAmplitude * speedFactor
        const waveOffset = Math.sin(time * 3 + i * 0.5) * waveAmplitude
        const perp = new THREE.Vector3(-headDir.z, 0, headDir.x)
        basePos.add(perp.multiplyScalar(waveOffset))
      }

      // Smooth transition to new position
      tailPositions[i].lerp(basePos, 0.1)
      
      // Update mesh position
      if (tailRefs.current[i]) {
        tailRefs.current[i].position.copy(tailPositions[i])
      }

      // Update previous position for next segment
      prevPos = tailPositions[i].clone()
    }
  })

  return (
    <>
      <mesh
        onPointerDown={(e) => {
          if (behavior === 'approach') {
            const pt = e.point.clone()
            pt.y = 0
            setApproachTarget(pt)
          }
        }}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <group>
        {/* Fish Head */}
        <mesh ref={headRef}>
          {/* Use ellipsoid shape for head by scaling a sphere */}
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial 
            color="#EOB0FF"  // Coral orange
            
          />
          <primitive object={new THREE.Object3D()} scale={[1.2, 0.85, 1]} />
        </mesh>

        {/* Tail Segments */}
        {tailPositions.map((pos, idx) => {
          // More dramatic tapering for a fish-like silhouette
          const segmentProgress = idx / numSegments
          // Exponential falloff for more natural tapering
          const taperFactor = Math.pow(1 - segmentProgress, 1.2)
          
          // Start wider at the body and taper more aggressively toward tail
          const baseRadius = 0.5
          const radius = baseRadius * taperFactor * (1 - (idx + 1) / (numSegments + 2))
          
          // Vertical compression increases toward tail
          const verticalScale = 0.85 - (segmentProgress * 0.15)
          
          // Color gradient from body to tail
          const color = new THREE.Color()
          color.setHSL(
            0.77,  // Orange-red hue
            1.0,   // Saturation
            0.85 - (segmentProgress * 0.2)  // Lightness decreases toward tail
          )

          return (
            <mesh
              key={idx}
              ref={(el) => (tailRefs.current[idx] = el)}
              position={pos}
            >
              <sphereGeometry args={[radius, 12, 12]} />
              <meshStandardMaterial 
                color={color}
                roughness={0.7}
                metalness={0.1}
              />
              <primitive object={new THREE.Object3D()} scale={[1, verticalScale, 1]} />
            </mesh>
          )
        })}
      </group>

      {/* Debug Overlay */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: 'white',
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.5)',
            padding: '5px'
          }}
        >
          Debug - Behavior: {behavior}
          <br />
          Target: {(() => {
            let t = new THREE.Vector3()
            if (behavior === 'rest') {
              t.copy(restTarget)
              t.y += Math.sin(Date.now() * 0.003) * 0.1
            } else if (behavior === 'follow') {
              const raycaster = new THREE.Raycaster()
              raycaster.setFromCamera(mouse, camera)
              const ct = new THREE.Vector3()
              const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
              raycaster.ray.intersectPlane(plane, ct)
              ct.y = 0
              t.copy(ct)
            } else if (behavior === 'approach') {
              t.copy(approachTarget)
              t.y = 0
            } else if (behavior === 'wander') {
              t.copy(wanderTargetRef.current)
              t.y = 0
            }
            return `${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}`
          })()}
        </div>
      </Html>

      {/* Approach Target Marker */}
      {behavior === 'approach' && (
        <Html position={approachTarget} style={{ pointerEvents: 'none' }}>
          <div style={{ color: 'red', fontSize: '24px', fontWeight: 'bold' }}>X</div>
        </Html>
      )}

      {/* Wander Target Marker */}
      {behavior === 'wander' && (
        <Html
          position={wanderTargetRef.current}
          style={{ pointerEvents: 'none' }}
          // Force marker to update by using a key based on position
          key={`wander-${wanderTargetRef.current.x.toFixed(3)}-${wanderTargetRef.current.z.toFixed(3)}`}
        >
          <div style={{
            color: '#4169E1',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: 0.8,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}>×</div>
        </Html>
      )}
    </>
  )
}

export default Fish 