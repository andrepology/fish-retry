// @ts-nocheck
import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, RootState, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useControls, Leva } from 'leva'
import { EffectComposer, Bloom, Pixelation } from '@react-three/postprocessing'
import { FishBehavior, FishState } from '../steering/FishBehavior'

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

  // Create the State Machine Instance
  const fishBehavior = useMemo(() => new FishBehavior({
    approachThreshold: arrivalThreshold,
    restDuration: 2,
    eatDuration: 1,
    bounds: { min: boundaryMin, max: boundaryMax },
    onEat: () => {
      // In a complete implementation, trigger an eating animation and then remove the food mesh.
      console.log('Food eaten – triggering onEat callback')
      setFoodTarget(null)
    },
  }), [arrivalThreshold, boundaryMin, boundaryMax])

  // Store time in a ref so we can use it throughout the component
  const timeRef = useRef(0)

  // Keep React state in sync with fishBehavior:
  const [currentBehavior, setCurrentBehavior] = useState(fishBehavior.state)
  const [foodTarget, setFoodTarget] = useState<THREE.Vector3 | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        // Manually force REST state.
        fishBehavior.resetTarget() // go to wander; then set rest manually:
        setRestTarget(headRef.current.position.clone())
        if (velocityRef.current.length() > 0.001) {
          setRestDirection(velocityRef.current.clone().normalize())
        } else {
          setRestDirection(new THREE.Vector3(0, 0, 1))
        }
        // For our purposes you might want to force the state machine into REST.
        fishBehavior.state = FishState.REST
        setCurrentBehavior(FishState.REST)
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
  }, [fishBehavior])

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
    // Update our time reference
    timeRef.current = state.clock.elapsedTime
    
    if (!headRef.current) return

    let currentTarget = new THREE.Vector3()
    const spacing = 0.5  // Base spacing (for the largest bone)

    // Update the state machine based on the head's position.
    fishBehavior.update(headRef.current.position, velocityRef.current, delta)

    // If the state changed, update our local React state accordingly:
    if (fishBehavior.state !== currentBehavior) {
      setCurrentBehavior(fishBehavior.state)
      // When transitioning back to WANDER, also clear our food target:
      if (fishBehavior.state === FishState.WANDER) {
        setFoodTarget(null)
      }
    }

    if (fishBehavior.state === FishState.REST) {
      // Use the stored rest position and direction from the state machine
      if (fishBehavior.restPosition && fishBehavior.restDirection) {
        const headSway = Math.sin(timeRef.current * swayFreq) * swayAmplitude;
        const perpSway = new THREE.Vector3(
          -fishBehavior.restDirection.z, 
          0, 
          fishBehavior.restDirection.x
        );
        
        currentTarget.copy(fishBehavior.restPosition)
          .add(perpSway.multiplyScalar(headSway));
        
        headRef.current.position.lerp(currentTarget, 0.1);
      }
    } else if (fishBehavior.state === FishState.WANDER) {
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
        timeRef.current - lastWanderUpdateRef.current > params.updateInterval || 
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
        lastWanderUpdateRef.current = timeRef.current

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
    } else if (fishBehavior.state === FishState.APPROACH) {
      if (!fishBehavior.target) return;

      // Store previous position for velocity calculation
      prevHeadPos.current.copy(headRef.current.position);

      // Use same params as wander for consistent movement
      const params = wanderParams.current

      // Bounds check (same as wander)
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

      // Calculate desired velocity toward target (using arrival behavior)
      const desired = new THREE.Vector3()
        .subVectors(fishBehavior.target, headRef.current.position)
      const distance = desired.length()
      
      desired.normalize()
      
      // Slow down as we approach target (same as wander)
      if (distance < params.slowingRadius) {
        desired.multiplyScalar(params.maxSpeed * (distance / params.slowingRadius))
      } else {
        desired.multiplyScalar(params.maxSpeed)
      }
      
      // Add a small wiggle to make movement more natural
      const wiggleAngle = Math.sin(timeRef.current * 2) * 0.2
      desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), wiggleAngle)
      
      // Apply steering force (same as wander)
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

      // Update velocity reference after position change
      velocityRef.current.copy(headRef.current.position).sub(prevHeadPos.current);
    } else if (fishBehavior.state === FishState.EAT) {
      // During EAT, the fish might pause or move minimally.
      headRef.current.position.add(currentVelocity.current.multiplyScalar(0.98))
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
    if (fishBehavior.state === FishState.REST) {
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

      if (fishBehavior.state === FishState.REST) {
        // Remove downward droop and bob, keep only sway
        const swayPhase = i * 0.2
        const attenuation = 1 - i / (numSegments * 1.5)
        const sway = Math.sin(timeRef.current * swayFreq + swayPhase) * (swayAmplitude * attenuation)
        const perpSway = new THREE.Vector3(-headDir.z, 0, headDir.x)
        basePos.add(perpSway.multiplyScalar(sway))
      } else {
        // Other behaviors use wave motion based on speed
        const speedFactor = THREE.MathUtils.clamp(velocityRef.current.length() * 10, 0.2, 1)
        const baseAmplitude = waveAmplitudeBase * (1 - i / numSegments)
        const waveAmplitude = baseAmplitude * speedFactor
        const waveOffset = Math.sin(timeRef.current * waveSpeed + i * 0.5) * waveAmplitude
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
      <EffectComposer enabled={false}>
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
          if (fishBehavior.state === FishState.WANDER) {  // Only accept food when wandering
            const pt = e.point.clone()
            pt.y = 0
            fishBehavior.setFoodTarget(pt)
            setFoodTarget(pt)
            console.log('Food placed, new state:', fishBehavior.state)
            setCurrentBehavior(FishState.APPROACH)
          }
        }}
        position={[0, -1, 0]}
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
            emissiveIntensity={0.4}
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

      {/* Food Marker - Updated visibility check and time reference */}
      {foodTarget && (fishBehavior.state === FishState.APPROACH || fishBehavior.state === FishState.EAT) && (
        <mesh
          position={[
            foodTarget.x,
            foodTarget.y + Math.sin(timeRef.current * 2) * 0.1,
            foodTarget.z,
          ]}
          castShadow
        >
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial 
            color="red"
            emissive="red"
            emissiveIntensity={0.3}
            toneMapped={false}
            transparent
            opacity={fishBehavior.state === FishState.EAT ? 0.5 : 1}
          />
        </mesh>
      )}

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
          Current State: {currentBehavior}
          {foodTarget &&
            ` | Food Target: (${foodTarget.x.toFixed(2)}, ${foodTarget.z.toFixed(2)})`
          }
        </div>
      </Html>

      {/* Approach Target Marker */}
      {fishBehavior.state === FishState.APPROACH && (
        <Html position={fishBehavior.target} style={{ pointerEvents: 'none' }}>
          <div style={{ color: 'red', fontSize: '24px', fontWeight: 'bold' }}>X</div>
        </Html>
      )}

      {/* Wander Target Marker */}
      {fishBehavior.state === FishState.WANDER && (
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