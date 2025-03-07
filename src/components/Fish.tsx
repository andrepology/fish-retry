import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, RootState, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useControls, Leva } from 'leva'
import { EffectComposer, Bloom, Pixelation, DepthOfField } from '@react-three/postprocessing'
import { FishBehavior, FishState } from '../steering/FishBehavior'
import { useSpeechInteraction } from '../hooks/useSpeechInteraction'



interface FishProps {
  onPositionUpdate?: (position: THREE.Vector3) => void
}

const Fish: React.FC<FishProps> = ({ onPositionUpdate }) => {
  // --- Basic configuration --
  const [tailCount, setTailCount] = useState(4)
  const { camera } = useThree()
  const headRef = useRef<THREE.Mesh>(null)
  const arrowRef = useRef<THREE.ArrowHelper>(null)

  // Create gradient texture for toon material
  const gradientMap = useMemo(() => {
    // Create a gradient with 4 distinct steps for visible toon shading
    const colors = new Uint8Array([0, 80, 160, 255])  // dark, dark-mid, light-mid, light
    const texture = new THREE.DataTexture(
      colors,
      colors.length,
      1,
      THREE.RedFormat
    )
    texture.needsUpdate = true
    return texture
  }, [])

  // Cache head geometry and material to avoid recreating every render
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.08, 32, 32), [])
  const headMaterial = useMemo(() => new THREE.MeshToonMaterial({
    color: '#E0B0FF',
    emissive: '#4B0082',
    emissiveIntensity: 0.4,
    toneMapped: false,
    gradientMap: gradientMap
  }), [gradientMap])

  // --- Single velocity vector instance (we removed the unused maxSpeed ref and velocityRef) ---
  const currentVelocity = useRef(new THREE.Vector3())
  const prevHeadPos = useRef(new THREE.Vector3())

  // --- For a smooth, consistent heading ---
  const lastHeadDir = useRef(new THREE.Vector3(0, 0, 1))

  // --- Time reference used for animations ---
  const timeRef = useRef(0)

  // --- State for wander target (also used to display marker) ---
  const wanderTargetRef = useRef(new THREE.Vector3())
  const lastWanderUpdateRef = useRef(0)
  const [wanderTargetState, setWanderTargetState] = useState(new THREE.Vector3(0, 0, 0))

  // --- Debug state for current behavior (used in overlay) ---
  const [currentBehavior, setCurrentBehavior] = useState<FishState>(FishState.WAMDER)

  // --- GUI controls for steering and tail behavior ---
  const movementControls = useControls('Movement', {
    maxSpeed: { value: 0.02, min: 0.01, max: 0.1, step: 0.01 },
    steeringForce: { value: 0.001, min: 0.0001, max: 0.01, step: 0.0001 },
    slowingRadius: { value: 2.0, min: 0.5, max: 5, step: 0.1 },
  }, { collapsed: true })

  const wanderControls = useControls('Wander', {
    visionRange: { value: 5, min: 1, max: 10, step: 0.5 },
    forwardDistance: { value: 2.5, min: 1, max: 5, step: 0.1 },
    radius: { value: 1, min: 0.1, max: 3, step: 0.1 },
    updateInterval: { value: 0.8, min: 0.1, max: 2, step: 0.1 },
    arrivalDistance: { value: 0.3, min: 0.1, max: 1, step: 0.1 },
  }, { collapsed: true })

  const boundaryControls = useControls('Boundaries', {
    min: { value: -20, min: -50, max: 0, step: 1 },
    max: { value: 20, min: 0, max: 50, step: 1 },
    buffer: { value: 30, min: 1, max: 10, step: 0.5 },
  }, { collapsed: true })

  const animationControls = useControls('Animation', {
    swayFrequency: { value: 1.0, min: 0.1, max: 5, step: 0.1 },
    swayAmount: { value: 0.1, min: 0, max: 0.5, step: 0.01 },
    waveSpeed: { value: 3, min: 0.1, max: 10, step: 0.1 },
    waveBase: { value: 0.2, min: 0, max: 1, step: 0.01 },
  }, { collapsed: true })

  // --- Consolidate wander parameters (used for movement and steering) ---
  const wanderParams = useRef({
    maxSpeed: movementControls.maxSpeed,
    maxSteerForce: movementControls.steeringForce,
    slowingRadius: movementControls.slowingRadius,
    visionDistance: wanderControls.visionRange,
    forwardDistance: wanderControls.forwardDistance,
    radius: wanderControls.radius,
    updateInterval: wanderControls.updateInterval,
    arrivalThreshold: wanderControls.arrivalDistance,
    bounds: { min: boundaryControls.min, max: boundaryControls.max },
    boundaryBuffer: boundaryControls.buffer,
  })

  // Update parameters when controls change
  useEffect(() => {
    wanderParams.current = {
      ...wanderParams.current,
      maxSpeed: movementControls.maxSpeed,
      maxSteerForce: movementControls.steeringForce,
      slowingRadius: movementControls.slowingRadius,
    }
  }, [movementControls])

  useEffect(() => {
    wanderParams.current = {
      ...wanderParams.current,
      visionDistance: wanderControls.visionRange,
      forwardDistance: wanderControls.forwardDistance,
      radius: wanderControls.radius,
      updateInterval: wanderControls.updateInterval,
      arrivalThreshold: wanderControls.arrivalDistance,
    }
  }, [wanderControls])

  useEffect(() => {
    wanderParams.current = {
      ...wanderParams.current,
      bounds: { min: boundaryControls.min, max: boundaryControls.max },
      boundaryBuffer: boundaryControls.buffer,
    }
  }, [boundaryControls])

  // --- Create FishBehavior instance (state machine) ---
  const fishBehavior = useMemo(() => new FishBehavior({
    approachThreshold: wanderControls.arrivalDistance,
    restDuration: 0.5,
    eatDuration: 0.3,
    bounds: { min: boundaryControls.min, max: boundaryControls.max },
    onEat: () => {
      console.log('Food eaten – triggering onEat callback')
      setFoodTarget(null)
      setTailCount((prev) => prev + 1)
    },
  }), [wanderControls.arrivalDistance, boundaryControls.min, boundaryControls.max])

  // --- Food target state (for placing food and marker rendering) ---
  const [foodTarget, setFoodTarget] = useState<THREE.Vector3 | null>(null)

  // --- Tail segments positions and refs ---
  const tailPositions = useRef<THREE.Vector3[]>([])
  const tailRefs = useRef<(THREE.Mesh | null)[]>([])
  

  useEffect(() => {
    if (tailPositions.current.length === 0) {
      const initialPositions: THREE.Vector3[] = []
      for (let i = 0; i < tailCount; i++) {
        initialPositions.push(new THREE.Vector3(0, -(i + 1) * 0.5, 0))
      }
      tailPositions.current = initialPositions
    }
  }, [])

  useEffect(() => {
    if (tailPositions.current.length < tailCount) {
      // Use the last segment's position (or a default value if none exist)
      const lastPos = tailPositions.current.length > 0 
        ? tailPositions.current[tailPositions.current.length - 1].clone()
        : new THREE.Vector3(0, -0.5, 0)
      const numToAdd = tailCount - tailPositions.current.length
      for (let i = 0; i < numToAdd; i++) {
        tailPositions.current.push(lastPos.clone())
      }
    }
  }, [tailCount])


  // --- Set up arrow helper for debugging the head's intended direction ---
  useEffect(() => {
    if (!headRef.current && !arrowRef.current) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), headRef.current.position, 1.5, 0x00ffff)
      arrowRef.current = arrow
      headRef.current.parent?.add(arrow)
    }
    return () => {
      if (arrowRef.current && headRef.current?.parent) {
        headRef.current.parent.remove(arrowRef.current)
        if (arrowRef.current.line) arrowRef.current.line.geometry.dispose()
        if (arrowRef.current.cone) arrowRef.current.cone.geometry.dispose()
        arrowRef.current.dispose()
        arrowRef.current = null
      }
    }
  }, [])

  // --- Keyboard controls for state transitions ---
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      return 
      if (key === 'r') {
        fishBehavior.resetTarget()
        if (headRef.current) {
          fishBehavior.restPosition = headRef.current.position.clone()
          fishBehavior.restDirection = (currentVelocity.current.length() > 0.001)
            ? currentVelocity.current.clone().normalize()
            : new THREE.Vector3(0, 0, 1)
        }
        setCurrentBehavior(FishState.REST)
      } else if (key === 'a') {
        fishBehavior.state = FishState.APPROACH
        setCurrentBehavior(FishState.APPROACH)
      } else if (key === 'w') {
        fishBehavior.state = FishState.WANDER
        if (headRef.current) {
          wanderTargetRef.current.copy(headRef.current.position)
          lastWanderUpdateRef.current = 0
          setWanderTargetState(headRef.current.position.clone())
        }
        setCurrentBehavior(FishState.WANDER)
      } else if (key === 't') {
        // Toggle TALK state
        if (fishBehavior.state === FishState.TALK) {
          fishBehavior.stopTalking()
        } else if (headRef.current) {
          fishBehavior.startTalking(
            headRef.current.position.clone(),
            currentVelocity.current.clone()
          )
        }
        setCurrentBehavior(fishBehavior.state)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fishBehavior])

  // --- Helper: Clamp a position to the allowed bounds ---
  const applyBounds = (position: THREE.Vector3) => {
    position.x = THREE.MathUtils.clamp(position.x, wanderParams.current.bounds.min, wanderParams.current.bounds.max)
    position.z = THREE.MathUtils.clamp(position.z, wanderParams.current.bounds.min, wanderParams.current.bounds.max)
  }

  // --- Helper: Update head movement based on state and update velocity ---
  const updateMovement = (delta: number) => {
    const params = wanderParams.current
    const priorPos = headRef.current!.position.clone()

    if ((fishBehavior.state === FishState.REST || fishBehavior.state === FishState.TALK) 
        && fishBehavior.stationaryPosition && fishBehavior.stationaryDirection) {
      const sway = Math.sin(timeRef.current * animationControls.swayFrequency) * animationControls.swayAmount
      const perp = new THREE.Vector3(-fishBehavior.stationaryDirection.z, 0, fishBehavior.stationaryDirection.x)
      const targetPos = fishBehavior.stationaryPosition.clone().add(perp.multiplyScalar(sway))
      headRef.current!.position.lerp(targetPos, 0.1)
    } else if (fishBehavior.state === FishState.WANDER) {
      applyBounds(headRef.current!.position)
      const forward = new THREE.Vector3()
      if (currentVelocity.current.length() > 0.001) {
        forward.copy(currentVelocity.current).setY(0).normalize()
      } else {
        forward.set(0, 0, 1)
      }
      const visionPoint = headRef.current!.position.clone().add(forward.clone().multiplyScalar(params.visionDistance))
      const isVisionOut = visionPoint.x < params.bounds.min + params.boundaryBuffer ||
                          visionPoint.x > params.bounds.max - params.boundaryBuffer ||
                          visionPoint.z < params.bounds.min + params.boundaryBuffer ||
                          visionPoint.z > params.bounds.max - params.boundaryBuffer
      const isTargetOut = wanderTargetRef.current.x < params.bounds.min ||
                          wanderTargetRef.current.x > params.bounds.max ||
                          wanderTargetRef.current.z < params.bounds.min ||
                          wanderTargetRef.current.z > params.bounds.max
      const distToTarget = headRef.current!.position.distanceTo(wanderTargetRef.current)
      const shouldUpdate = (timeRef.current - lastWanderUpdateRef.current > params.updateInterval) ||
                           (distToTarget < params.arrivalThreshold) ||
                           isTargetOut ||
                           isVisionOut
      if (shouldUpdate) {
        let base = new THREE.Vector3()
        if (isVisionOut) {
          const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), headRef.current!.position).normalize()
          base.copy(headRef.current!.position).add(toCenter.multiplyScalar(params.forwardDistance))
        } else {
          base.copy(headRef.current!.position).add(forward.multiplyScalar(params.forwardDistance))
        }
        const angle = Math.random() * Math.PI * 2
        const offsetLen = Math.random() * params.radius
        const offset = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(offsetLen)
        const newTarget = base.clone().add(offset)
        newTarget.x = THREE.MathUtils.clamp(newTarget.x, params.bounds.min, params.bounds.max)
        newTarget.z = THREE.MathUtils.clamp(newTarget.z, params.bounds.min, params.bounds.max)
        newTarget.y = 0
        wanderTargetRef.current.copy(newTarget)
        lastWanderUpdateRef.current = timeRef.current
        setWanderTargetState(newTarget.clone())
      }
      const desired = new THREE.Vector3().subVectors(wanderTargetRef.current, headRef.current!.position)
      const dist = desired.length()
      desired.normalize()
      if (dist < params.slowingRadius) {
        desired.multiplyScalar(params.maxSpeed * (dist / params.slowingRadius))
      } else {
        desired.multiplyScalar(params.maxSpeed)
      }
      const steer = desired.sub(currentVelocity.current)
      steer.clampLength(0, params.maxSteerForce)
      currentVelocity.current.add(steer)
      currentVelocity.current.clampLength(0, params.maxSpeed)
      headRef.current!.position.add(currentVelocity.current)
      applyBounds(headRef.current!.position)
    } else if (fishBehavior.state === FishState.APPROACH) {
      if (!fishBehavior.target) return
      const params = wanderParams.current
      const desired = new THREE.Vector3().subVectors(fishBehavior.target, headRef.current!.position)
      const dist = desired.length()
      desired.normalize()
      if (dist < params.slowingRadius) {
        desired.multiplyScalar(params.maxSpeed * (dist / params.slowingRadius))
      } else {
        desired.multiplyScalar(params.maxSpeed)
      }
      const wiggle = Math.sin(timeRef.current * 2) * 0.2
      desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), wiggle)
      const steer = desired.sub(currentVelocity.current)
      steer.clampLength(0, params.maxSteerForce)
      currentVelocity.current.add(steer)
      currentVelocity.current.clampLength(0, params.maxSpeed)
      headRef.current!.position.add(currentVelocity.current)
      applyBounds(headRef.current!.position)
    } else if (fishBehavior.state === FishState.EAT) {
      headRef.current!.position.add(currentVelocity.current.clone().multiplyScalar(0.98))
    }
    // Update velocity based on how far the head has moved in this frame
    const displacement = headRef.current!.position.clone().sub(priorPos)
    currentVelocity.current.copy(displacement).clampLength(0, params.maxSpeed)
    prevHeadPos.current.copy(headRef.current!.position)
  }

  // --- Helper: Compute a smooth intended heading for the head (used by tail update) ---
  const computeTargetDirection = (): THREE.Vector3 => {
    const candidate = new THREE.Vector3()
    if (fishBehavior.state === FishState.REST && fishBehavior.restDirection) {
      candidate.copy(fishBehavior.restDirection)
    } else if (fishBehavior.state === FishState.APPROACH && fishBehavior.target) {
      candidate.copy(fishBehavior.target).sub(headRef.current!.position)
      candidate.y = 0
      if (candidate.length() > 0.001) {
        candidate.normalize()
      } else {
        candidate.copy(lastHeadDir.current)
      }
    } else if (currentVelocity.current.length() > 0.001) {
      candidate.copy(currentVelocity.current).normalize()
    } else {
      candidate.copy(lastHeadDir.current)
    }
    return candidate
  }

  // --- Helper: Update tail segments to follow the head using the smoothed heading ---
  const updateTailSegments = (headDirection: THREE.Vector3) => {
    let prevPos = headRef.current!.position.clone()
    for (let i = 0; i < tailCount; i++) {
      const segProgress = i / tailCount;
      const taperFactor = Math.pow(1 - segProgress, 1.2)
      const spacing = 0.5 * taperFactor
      const basePos = prevPos.clone().addScaledVector(headDirection, -spacing)
      if (fishBehavior.state === FishState.REST) {
        const swayPhase = i * 0.2
        const attenuation = 1 - i / (tailCount * 1.5)
        const sway = Math.sin(timeRef.current * animationControls.swayFrequency + swayPhase) * (animationControls.swayAmount * attenuation)
        const perp = new THREE.Vector3(-headDirection.z, 0, headDirection.x)
        basePos.add(perp.multiplyScalar(sway))
      } else {
        const speedFactor = THREE.MathUtils.clamp(currentVelocity.current.length() * 10, 0.2, 1)
        const baseAmp = animationControls.waveBase * (1 - i / tailCount)
        const waveAmp = baseAmp * speedFactor
        const waveOffset = Math.sin(timeRef.current * animationControls.waveSpeed + i * 0.5) * waveAmp
        const perp = new THREE.Vector3(-headDirection.z, 0, headDirection.x)
        basePos.add(perp.multiplyScalar(waveOffset))
      }
      tailPositions.current[i].lerp(basePos, 0.1)
      const curDist = tailPositions.current[i].distanceTo(prevPos)
      // NOTE: NEEDED for smooth turns. 1.05 does NOT work. Needed for constrained turns.
      if (curDist > spacing ) {
        tailPositions.current[i].sub(prevPos).setLength(spacing)
        tailPositions.current[i].add(prevPos)
      }
      if (tailRefs.current[i]) {
        tailRefs.current[i]!.position.copy(tailPositions.current[i])
      }
      prevPos = tailPositions.current[i].clone()
    }
  }

  // --- Main animation loop ---
  const lineEndRef = useRef(new THREE.Vector3(0, 1.5, 0))

  // Import our speech hook.
  const { startRecording, stopRecording, userSpeech, fishResponse } = useSpeechInteraction()

  // Add this with other controls
  const cameraControls = useControls('Camera', {
    locked: { value: false, label: 'Lock to Fish' },
    followDistance: { value: 5, min: 2, max: 10, step: 0.1 },
    height: { value: 3, min: 1, max: 10, step: 0.1 },
  }, { collapsed: true })

  useFrame((state: RootState, delta: number) => {
    timeRef.current = state.clock.elapsedTime
    if (!headRef.current) return

    // Update the fish behavior state machine
    fishBehavior.update(headRef.current.position, currentVelocity.current, delta)
    setCurrentBehavior(fishBehavior.state)

    // Update movement (head position, steering, and velocity)
    updateMovement(delta)

    // Compute a smoothed intended direction (to drive the tail)
    const newDirCandidate = computeTargetDirection()
    lastHeadDir.current.lerp(newDirCandidate, 0.5)
    const intendedDir = lastHeadDir.current.clone()

    // Update arrow helper (for debugging)
    if (arrowRef.current) {
      arrowRef.current.position.copy(headRef.current.position)
      arrowRef.current.setDirection(intendedDir)
    }

    // Update tail segments so they follow the head smoothly
    updateTailSegments(intendedDir)

    // Calculate perspective line
    if (headRef.current) {
      // Get head position in world space
      const headPosition = headRef.current.position.clone()
      
      // Project head position to screen space
      const headScreenSpace = headPosition.clone().project(state.camera)
      
      // Calculate angle based on screen position
      const angleToCenter = Math.atan2(headScreenSpace.x, 1) // 1 is the distance to projection plane
      const maxTilt = 0 // 45 degrees maximum tilt
      const lineLength = 3.5 // Fixed line length
      
      // Create a vector pointing up
      const lineVector = new THREE.Vector3(
        Math.sin(angleToCenter) * maxTilt,
        1,
        -Math.abs(Math.sin(angleToCenter)) * 0.5
      ).normalize().multiplyScalar(lineLength)

      // Update end point
      lineEndRef.current.copy(lineVector)
    }

    // Force a re-render of the line by updating its points
    if (headRef.current && lineEndRef.current) {
      const points = [
        [0, 0, 0],
        [lineEndRef.current.x, lineEndRef.current.y, lineEndRef.current.z]
      ]
      if (lineRef.current) {
        lineRef.current.geometry.setFromPoints(
          points.map(p => new THREE.Vector3(p[0], p[1], p[2]))
        )
      }
    }

    // After updating the fish's position,
    // if a callback was provided, report the fish head's current position.
    if (headRef.current && onPositionUpdate) {
      onPositionUpdate(headRef.current.position.clone())
    }

    // Camera follow logic
    if (cameraControls.locked && headRef.current) {
      const targetPosition = headRef.current.position.clone()
      
      // Calculate camera position behind the fish
      const cameraOffset = new THREE.Vector3()
      
      // Use the fish's velocity direction, or fallback to last known direction
      const fishDirection = currentVelocity.current.length() > 0.001
        ? currentVelocity.current.clone().normalize()
        : lastHeadDir.current

      // Position camera behind and above fish
      cameraOffset.copy(fishDirection)
        .multiplyScalar(-cameraControls.followDistance)
        .add(new THREE.Vector3(0, cameraControls.height, 0))

      // Smoothly move camera to new position
      state.camera.position.lerp(targetPosition.add(cameraOffset), 0.1)
      
      // Look at fish
      state.camera.lookAt(headRef.current.position)
    }
  })

  // Add this ref for the Line
  const lineRef = useRef<THREE.Line>(null)

  // Add these near the top with other state declarations
  const [displayWords, setDisplayWords] = useState<{ text: string; visible: boolean }[]>([]);
  const fullText = "Where there is a will, there is a way.";
  const wordDelay = 200; // milliseconds between words

  // Update the text streaming logic
  useEffect(() => {
    if (fishBehavior.state === FishState.TALK) {
      const words = fullText.split(' ');
      // Initialize all words as invisible
      setDisplayWords(words.map(word => ({ text: word, visible: false })));
      
      // Make each word visible one at a time
      words.forEach((_, index) => {
        setTimeout(() => {
          setDisplayWords(prev => 
            prev.map((word, i) => 
              i === index ? { ...word, visible: true } : word
            )
          );
        }, index * wordDelay + Math.random() * 200);
      });
    } else {
      setDisplayWords([]);
    }
  }, [fishBehavior.state]);

  return (
    <>
      {/* Add OrbitControls with enabled state based on lock */}
      <OrbitControls enabled={!cameraControls.locked} />

      {/* Move Bloom inside a group with just the Fish elements */}
      <group>
        <EffectComposer enabled={true}>
          <Bloom 
            intensity={50.0}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.5}
            mipmapBlur={true}
            kernelSize={2}
            resolutionScale={0.5}
          />
          
        </EffectComposer>

        {/* Ground plane for food-click detection */}
        <mesh
          onPointerDown={(e) => {
            const pt = e.point.clone()
            pt.y = 0
            fishBehavior.setFoodTarget(pt)
            setFoodTarget(pt)
            console.log('Food placed, new state:', fishBehavior.state)
            setCurrentBehavior(fishBehavior.state)
          }}
          position={[0, -1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        <group>
          {/* Fish Head with added pointer events for speech interaction */}
          <mesh 
            ref={headRef}
            castShadow
            onPointerDown={(e) => {
              // Start recording when pressed on the fish head.
              startRecording()
            }}
            onPointerUp={(e) => {
              // Stop recording when the pointer is released.
              stopRecording()
            }}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshToonMaterial 
              color="#E0B0FF"
              emissive="#4B0082"
              emissiveIntensity={0.4}
              toneMapped={false}
              gradientMap={gradientMap}
            />
            <primitive object={new THREE.Object3D()} scale={[1.2, 0.85, 1]} />
            {/* If the fish is already in TALK state from previous behavior... */}
            {(fishBehavior.state === FishState.TALK) && (
              <group>
                {/* Existing talk bubble (if any) */}
                <Html
                  position={[2.5, 4.5, -0.5]}
                  transform
                  occlude
                  distanceFactor={7}
                >
                  <div className="min-w-[120px] max-w-[200px] flex justify-start bg-black/30 text-white px-3 py-2 rounded-md border border-white/20 font-mono text-sm">
                    <div className="flex flex-wrap gap-1">
                      {displayWords.map((word, index) => (
                        <span
                          key={index}
                          className={`transition-opacity duration-300 ${
                            word.visible ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          {word.text}
                        </span>
                      ))}
                      {displayWords.length === 0 && '\u00A0'}
                    </div>
                  </div>
                </Html>
              </group>
            )}
          </mesh>

          {/* Display user's transcribed speech above the fish head */}
          {userSpeech && headRef.current && (
            <Html
              position={[
                headRef.current.position.x,
                headRef.current.position.y + 1.2,
                headRef.current.position.z
              ]}
              transform
              occlude
              distanceFactor={7}
            >
              <div className="bg-green-500 text-white px-3 py-1 rounded-md shadow-lg">
                You: {userSpeech}
              </div>
            </Html>
          )}

          {/* Display the fish's response below the user speech */}
          {fishResponse && headRef.current && (
            <Html
              position={[
                headRef.current.position.x,
                headRef.current.position.y + 0.6,
                headRef.current.position.z
              ]}
              transform
              occlude
              distanceFactor={7}
            >
              <div className="bg-blue-500 text-white px-3 py-1 rounded-md shadow-lg">
                Fish: {fishResponse}
              </div>
            </Html>
          )}

          {/* Tail Segments */}
          {tailPositions.current.map((pos, idx) => {
            const segProgress = idx / tailCount;
            const taperFactor = Math.pow(1 - segProgress, 0.5);
            const baseRadius = 0.15;
            const radius = baseRadius * taperFactor * (1 - (idx + 1) / (tailCount + 2));
            const verticalScale = 0.85 - (segProgress * 0.15);
            const color = new THREE.Color();
            color.setHSL(0.77, 1.0, 0.9 - (segProgress * 0.3));
            return (
              <mesh
                key={idx}
                ref={(el) => tailRefs.current[idx] = el}
                position={pos}
                castShadow
              >
                <sphereGeometry args={[radius, 12, 12]} />
                <meshToonMaterial 
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.3}
                  toneMapped={false}
                  gradientMap={gradientMap}
                />
                <primitive object={new THREE.Object3D()} scale={[1, verticalScale, 1]} />
              </mesh>
            );
          })}
        </group>

        {/* Food Marker */}
        { [fishBehavior.target, ...fishBehavior.targetQueue].filter(Boolean).map((ft, idx) => (
          <mesh
            key={idx}
            position={[
              ft!.x,
              ft!.y + Math.sin(timeRef.current * 3) * 0.05 + 0.02,
              ft!.z,
            ]}
            castShadow
          >
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshToonMaterial 
              color="#FFFFFF"
              emissive="#FFFFFF"
              emissiveIntensity={0.2}
              toneMapped={false}
              gradientMap={gradientMap}
            />
          </mesh>
        ))}

        {/* Debug Overlay */}
        {/* <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: 'white',
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.5)',
            padding: '5px'
          }}>
            Current State: {currentBehavior} | 
            Speed: {currentVelocity.current?.length().toFixed(4)} / {movementControls.maxSpeed.toFixed(4)}
            {foodTarget && ` | Food Target: (${foodTarget.x.toFixed(2)}, ${foodTarget.z.toFixed(2)})`}
          </div>
        </Html> */}

        {/* (Optional) Wander Target Marker */}
        {fishBehavior.state === FishState.WANDER && (
          <Html
            position={[wanderTargetState.x, wanderTargetState.y, wanderTargetState.z]}
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
      </group>
    </>
  )
}

export default Fish