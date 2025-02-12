// @ts-nocheck
import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, RootState, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useControls, Leva } from 'leva'
import { EffectComposer, Bloom, Pixelation } from '@react-three/postprocessing'


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
  const currentVelocity = useRef(new THREE.Vector3())
  const maxSpeed = useRef(0.03)
  const maxSteerForce = useRef(0.001)

  // New state added for wander target reactive updates:
  const [wanderTargetState, setWanderTargetState] = useState(new THREE.Vector3(0, 0, 0))

  const [behavior, setBehavior] = useState<Behavior>('rest')
  const [restTarget, setRestTarget] = useState(new THREE.Vector3(0, 0, 0))
  const [restDirection, setRestDirection] = useState(new THREE.Vector3(0, 0, 1))
  const [approachTarget, setApproachTarget] = useState(new THREE.Vector3(0, 0, 0))

  // Add GUI controls
  const {
    // Wander parameters
    maxSpeed: guiMaxSpeed,
    maxSteerForce: guiMaxSteerForce,
    slowingRadius,
    visionDistance,
    forwardDistance,
    radius,
    updateInterval,
    arrivalThreshold,
    boundaryMin,
    boundaryMax,
    boundaryBuffer,
    
    // Tail wave parameters
    swayFreq,
    swayAmplitude,
    waveSpeed,
    waveAmplitudeBase,
  } = useControls({
    // Wander controls
    maxSpeed: { value: 0.02, min: 0.01, max: 0.1, step: 0.01 },
    maxSteerForce: { value: 0.001, min: 0.0001, max: 0.01, step: 0.0001 },
    slowingRadius: { value: 2.0, min: 0.5, max: 5, step: 0.1 },
    visionDistance: { value: 5, min: 1, max: 10, step: 0.5 },
    forwardDistance: { value: 2.5, min: 1, max: 5, step: 0.1 },
    radius: { value: 1, min: 0.1, max: 3, step: 0.1 },
    updateInterval: { value: 0.8, min: 0.1, max: 2, step: 0.1 },
    arrivalThreshold: { value: 0.3, min: 0.1, max: 1, step: 0.1 },
    boundaryMin: { value: -20, min: -50, max: 0, step: 1 },
    boundaryMax: { value: 20, min: 0, max: 50, step: 1 },
    boundaryBuffer: { value: 3, min: 1, max: 10, step: 0.5 },
    
    // Tail wave controls
    swayFreq: { value: 1.0, min: 0.1, max: 5, step: 0.1 },
    swayAmplitude: { value: 0.1, min: 0, max: 0.5, step: 0.01 },
    waveSpeed: { value: 3, min: 0.1, max: 10, step: 0.1 },
    waveAmplitudeBase: { value: 0.2, min: 0, max: 1, step: 0.01 },
  }, {
    collapsed: true,
  })

  // Update wanderParams with GUI values
  const wanderParams = useRef({
    maxSpeed: guiMaxSpeed,
    maxSteerForce: guiMaxSteerForce,
    slowingRadius,
    visionDistance,
    forwardDistance,
    radius,
    updateInterval,
    arrivalThreshold,
    bounds: { min: boundaryMin, max: boundaryMax },
    boundaryBuffer,
  })

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
          setWanderTargetState(headRef.current.position.clone())
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
    if (!headRef.current) {
      // Cleanup any existing arrow first
      if (arrowRef.current && headRef.current.parent) {
        headRef.current.parent.remove(arrowRef.current)
        arrowRef.current.dispose()
        arrowRef.current = null
      }

      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        headRef.current.position,
        1.5,
        0x00ffff
      )
      arrowRef.current = arrow
      headRef.current.parent?.add(arrow)

      return () => {
        if (arrowRef.current && headRef.current?.parent) {
          headRef.current.parent.remove(arrowRef.current)
          if (arrowRef.current.line) arrowRef.current.line.geometry.dispose()
          if (arrowRef.current.cone) arrowRef.current.cone.geometry.dispose()
          arrowRef.current.dispose()
          arrowRef.current = null
        }
      }
    }
  }, [])

  useFrame((state: RootState, delta: number) => {
    if (!headRef.current) return

    const time = state.clock.elapsedTime
    let currentTarget = new THREE.Vector3()
    const spacing = 0.5  // Base spacing (for the largest bone)

    if (behavior === 'rest') {
      // Calculate head motion first
      const headSway = Math.sin(time * swayFreq) * swayAmplitude

      // Apply to head position
      const perpSway = new THREE.Vector3(-restDirection.z, 0, restDirection.x)
      currentTarget.copy(restTarget)
        .add(perpSway.multiplyScalar(headSway))
      
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
      // Use wanderParams.current instead of separate object
      const params = wanderParams.current

      // Update bounds checks
      headRef.current.position.x = THREE.MathUtils.clamp(
        headRef.current.position.x,
        params.bounds.min,
        params.bounds.max
      )
      headRef.current.position.z = THREE.MathUtils.clamp(
        headRef.current.position.z,
        params.bounds.min,
        params.bounds.max
      )

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
      const visionPoint = headRef.current.position.clone().add(forward.clone().multiplyScalar(params.visionDistance))
      const isVisionPointOutOfBounds = 
        visionPoint.x < params.bounds.min + params.boundaryBuffer ||
        visionPoint.x > params.bounds.max - params.boundaryBuffer ||
        visionPoint.z < params.bounds.min + params.boundaryBuffer ||
        visionPoint.z > params.bounds.max - params.boundaryBuffer

      // Check if current target is out of bounds
      const isTargetOutOfBounds = 
        wanderTargetRef.current.x < params.bounds.min ||
        wanderTargetRef.current.x > params.bounds.max ||
        wanderTargetRef.current.z < params.bounds.min ||
        wanderTargetRef.current.z > params.bounds.max

      const shouldUpdateTarget = 
        time - lastWanderUpdateRef.current > params.updateInterval || 
        headRef.current.position.distanceTo(wanderTargetRef.current) < params.arrivalThreshold ||
        isTargetOutOfBounds ||
        isVisionPointOutOfBounds

      if (shouldUpdateTarget) {
        let targetBase
        if (isVisionPointOutOfBounds) {
          // Calculate direction to center when obstacle detected
          const toCenter = new THREE.Vector3(0, 0, 0).sub(headRef.current.position).normalize()
          targetBase = headRef.current.position.clone()
          targetBase.add(toCenter.multiplyScalar(params.forwardDistance))
        } else {
          // Normal forward-based targeting
          targetBase = headRef.current.position.clone()
          targetBase.add(forward.multiplyScalar(params.forwardDistance))
        }

        // Calculate random offset within radius (on XZ plane)
        const angle = Math.random() * Math.PI * 2
        const offsetLength = Math.random() * params.radius
        const offset = new THREE.Vector3(
          Math.cos(angle),
          0,
          Math.sin(angle)
        ).multiplyScalar(offsetLength)

        // Apply offset and clamp to bounds
        const newTarget = targetBase.clone().add(offset)
        newTarget.x = THREE.MathUtils.clamp(
          newTarget.x,
          params.bounds.min,
          params.bounds.max
        )
        newTarget.z = THREE.MathUtils.clamp(
          newTarget.z,
          params.bounds.min,
          params.bounds.max
        )
        newTarget.y = 0

        wanderTargetRef.current.copy(newTarget)
        lastWanderUpdateRef.current = time

        // Update the state so React triggers a re-render of the marker
        setWanderTargetState(newTarget.clone())
      }

      // Update steering behavior to use params
      const desired = new THREE.Vector3()
        .subVectors(wanderTargetRef.current, headRef.current.position)
      const distance = desired.length()
      
      desired.normalize()
      
      if (distance < params.slowingRadius) {
        desired.multiplyScalar(params.maxSpeed * (distance / params.slowingRadius))
      } else {
        desired.multiplyScalar(params.maxSpeed)
      }
      
      const steer = desired.sub(currentVelocity.current)
      steer.clampLength(0, params.maxSteerForce)
      
      currentVelocity.current.add(steer)
      currentVelocity.current.clampLength(0, params.maxSpeed)
      
      headRef.current.position.add(currentVelocity.current)

      // Final bounds check
      headRef.current.position.x = THREE.MathUtils.clamp(
        headRef.current.position.x,
        params.bounds.min,
        params.bounds.max
      )
      headRef.current.position.z = THREE.MathUtils.clamp(
        headRef.current.position.z,
        params.bounds.min,
        params.bounds.max
      )
    } else if (behavior === 'approach') {
      currentTarget.copy(approachTarget)
      currentTarget.y = 0
      headRef.current.position.lerp(currentTarget, 0.02)
    }

    // Update velocity
    velocityRef.current.copy(headRef.current.position).sub(prevHeadPos.current)

    // Limit maximum velocity to ensure the tail segments remain connected
    const maxVelocity = 0.3; // Adjust as needed
    if (velocityRef.current.length() > maxVelocity) {
      velocityRef.current.setLength(maxVelocity);
    }

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

    // Tail segments update with dynamic spacing to account for tapering:
    let prevPos = headRef.current.position.clone()
    for (let i = 0; i < numSegments; i++) {
      // Compute a taper factor for this segment (mirrors the computation in the mesh render)
      const segmentProgress = i / numSegments
      const taperFactor = Math.pow(1 - segmentProgress, 1.2)

      // Dynamic spacing based on the taper factor:
      const dynamicSpacing = spacing * taperFactor

      // Compute the base target position for this segment relative to the previous one
      const basePos = new THREE.Vector3()
        .copy(prevPos)
        .addScaledVector(headDir, -dynamicSpacing)

      if (behavior === 'rest') {
        // Remove downward droop and bob, keep only sway
        const swayPhase = i * 0.2
        const attenuation = 1 - i / (numSegments * 1.5)
        const sway = Math.sin(time * swayFreq + swayPhase) * (swayAmplitude * attenuation)
        const perpSway = new THREE.Vector3(-headDir.z, 0, headDir.x)
        basePos.add(perpSway.multiplyScalar(sway))
      } else {
        // Other behaviors use wave motion based on speed
        const speedFactor = THREE.MathUtils.clamp(velocityRef.current.length() * 10, 0.2, 1)
        const baseAmplitude = waveAmplitudeBase * (1 - i / numSegments)
        const waveAmplitude = baseAmplitude * speedFactor
        const waveOffset = Math.sin(time * waveSpeed + i * 0.5) * waveAmplitude
        const perp = new THREE.Vector3(-headDir.z, 0, headDir.x)
        basePos.add(perp.multiplyScalar(waveOffset))
      }

      // Smooth transition for this segment to the target position
      tailPositions[i].lerp(basePos, 0.1)

      // Correction: Ensure the segment stays at the dynamic spacing distance from prevPos
      const currentDistance = tailPositions[i].distanceTo(prevPos)
      if (currentDistance > dynamicSpacing * 1.05) { // allow a small tolerance
        tailPositions[i].sub(prevPos).setLength(dynamicSpacing)
        tailPositions[i].add(prevPos)
      }

      // Update the mesh position if the ref exists
      if (tailRefs.current[i]) {
        tailRefs.current[i].position.copy(tailPositions[i])
      }

      // Use this segment's position as the new base for the next segment
      prevPos = tailPositions[i].clone()
    }
  })

 

  return (
    <>
      <EffectComposer enabled={true}>
        <Bloom 
          intensity={50.0}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.5}
          mipmapBlur={true}
          kernelSize={2}
          resolutionScale={0.5}
        />
        <Pixelation 
          granularity={5}
        />
      </EffectComposer>

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
        <mesh ref={headRef} castShadow>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial 
            color="#E0B0FF"
            emissive="#4B0082"
            emissiveIntensity={0.5}
            toneMapped={false}
          />
          <primitive object={new THREE.Object3D()} scale={[1.2, 0.85, 1]} />
        </mesh>

        {/* Tail Segments */}
        {tailPositions.map((pos, idx) => {
          // More dramatic tapering for a fish-like silhouette
          const segmentProgress = idx / numSegments
          // Exponential falloff for more natural tapering
          const taperFactor = Math.pow(1 - segmentProgress, 0.5)
          
          // Start wider at the body and taper more aggressively toward tail
          const baseRadius = 0.15
          const radius = baseRadius * taperFactor * (1 - (idx + 1) / (numSegments + 2))
          
          // Vertical compression increases toward tail
          const verticalScale = 0.85 - (segmentProgress * 0.15)
          
          // Color gradient from body to tail
          const color = new THREE.Color()
          color.setHSL(
            0.77,  // Orange-red hue
            1.0,   // Saturation
            0.9 - (segmentProgress * 0.3)  // Lightness decreases toward tail
          )

          return (
            <mesh
              key={idx}
              ref={(el) => (tailRefs.current[idx] = el)}
              position={pos}
              castShadow
            >
              <sphereGeometry args={[radius, 12, 12]} />
              <meshStandardMaterial 
                color={color}
                emissive={color}  // Match base color for glow
                emissiveIntensity={0.3}  // Less intense than head
                toneMapped={false}
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
          position={[
            wanderTargetState.x,
            wanderTargetState.y,
            wanderTargetState.z
          ]}
          style={{ pointerEvents: 'none' }}
          key={`${wanderTargetState.x.toFixed(2)}-${wanderTargetState.y.toFixed(2)}-${wanderTargetState.z.toFixed(2)}`}
        >
          <div style={{
            display: 'none',
            color: '#4169E1',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: 0.8,
            transform: 'translate(-50%, -50%)'
          }}>×</div>
        </Html>
      )}
    </>
  )
}

export default Fish 