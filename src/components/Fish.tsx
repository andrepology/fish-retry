// @ts-nocheck
import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, RootState, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

type Behavior = 'rest' | 'follow' | 'approach'

const Fish: React.FC = () => {
  // Increase number of tail segments for more fish-like shape
  const numSegments = 8

  const { mouse, camera } = useThree()
  const headRef = useRef<THREE.Mesh>(null)
  const prevHeadPos = useRef(new THREE.Vector3())
  const velocityRef = useRef(new THREE.Vector3())
  const arrowRef = useRef(null)

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

    if (behavior === 'rest') {
      // Calculate head motion first
      const headSwayFreq = 1.0
      const headBobFreq = 1.2
      const headSwayAmplitude = 0.1
      const headBobAmplitude = 0.3
      
      // Calculate head sway and bob
      const headSway = Math.sin(time * headSwayFreq) * headSwayAmplitude
      const headBob = Math.sin(time * headBobFreq) * headBobAmplitude

      // Apply to head position
      const perpSway = new THREE.Vector3(-restDirection.z, 0, restDirection.x)
      currentTarget.copy(restTarget)
        .add(perpSway.multiplyScalar(headSway))
        .add(new THREE.Vector3(0, headBob, 0))

      // Update head position with the new motion
      headRef.current.position.lerp(currentTarget, 0.1)

      // Update tail segments with phase-shifted motion from head
      for (let i = 0; i < numSegments; i++) {
        const spacing = 0.5
        // Add downward curve to the base position
        const droopAmount = 0.15 * (i / numSegments) ** 2  // Quadratic droop increases toward tail end
        const basePos = new THREE.Vector3()
          .copy(headRef.current.position)
          .addScaledVector(restDirection, -spacing * (i + 1))
          .add(new THREE.Vector3(0, -droopAmount, 0))  // Apply droop
        
        // Add side-to-side swaying (phase shifted from head)
        const swayPhase = i * 0.2  // phase offset along spine
        const swayAmplitude = headSwayAmplitude * (1 - i / (numSegments * 1.5))  // attenuated amplitude
        const sway = Math.sin(time * headSwayFreq + swayPhase) * swayAmplitude
        
        // Add up-down motion (phase shifted from head)
        const bobPhase = i * 0.15
        const bobAmplitude = headBobAmplitude * (1 - i / (numSegments * 1.5))
        const bob = Math.sin(time * headBobFreq + bobPhase) * bobAmplitude

        // Compute perpendicular vector for sway direction
        const perpSway = new THREE.Vector3(-restDirection.z, 0, restDirection.x)
        
        // Apply both motions
        const desiredPos = basePos.clone()
          .add(perpSway.multiplyScalar(sway))
          .add(new THREE.Vector3(0, bob, 0))
        
        // Smooth transition to new position
        tailPositions[i].lerp(desiredPos, 0.1)
        if (tailRefs.current[i]) {
          tailRefs.current[i].position.copy(tailPositions[i])
        }
      }
    } else if (behavior === 'follow') {
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const followTargetCursor = new THREE.Vector3()
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      raycaster.ray.intersectPlane(plane, followTargetCursor)
      followTargetCursor.y = 0
      currentTarget.copy(followTargetCursor)
    } else if (behavior === 'approach') {
      currentTarget.copy(approachTarget)
      currentTarget.y = 0
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

    // Compute perpendicular vector for tail wave
    const perp = new THREE.Vector3(-headDir.z, 0, headDir.x)
    const speedFactor = THREE.MathUtils.clamp(velocityRef.current.length() * 10, 0.2, 1)

    // Update tail segments
    if (behavior === 'rest') {
      // In rest mode, add gentle swaying and bobbing
      for (let i = 0; i < numSegments; i++) {
        const spacing = 0.5
        const basePos = new THREE.Vector3()
          .copy(headRef.current.position)
          .addScaledVector(restDirection, -spacing * (i + 1))
        
        // Add gentle side-to-side swaying (attenuated along the spine)
        const swayFreq = 1.0  // slower frequency for rest
        const swayPhase = i * 0.2  // phase offset along spine
        const swayAmplitude = 0.3 * (1 - i / (numSegments * 2))  // attenuated amplitude
        const sway = Math.sin(time * swayFreq + swayPhase) * swayAmplitude
        
        // Add subtle up-down motion (also attenuated)
        const bobFreq = 1.2  // slightly different frequency for variety
        const bobPhase = i * 0.15
        const bobAmplitude = 0.03 * (1 - i / (numSegments * 2))
        const bob = Math.sin(time * bobFreq + bobPhase) * bobAmplitude

        // Compute perpendicular vector for sway direction
        const perpSway = new THREE.Vector3(-restDirection.z, 0, restDirection.x)
        
        // Apply both motions
        const desiredPos = basePos.clone()
          .add(perpSway.multiplyScalar(sway))
          .add(new THREE.Vector3(0, bob, 0))
        
        // Smooth transition to new position
        tailPositions[i].lerp(desiredPos, 0.1)
        if (tailRefs.current[i]) {
          tailRefs.current[i].position.copy(tailPositions[i])
        }
      }
    } else {
      // In other modes, use chain-like update with wave
      let followTarget = headRef.current.position.clone()
      for (let i = 0; i < numSegments; i++) {
        tailPositions[i].lerp(followTarget, 0.1)
        const baseAmplitude = 0.2 * (1 - i / numSegments)
        const waveAmplitude = baseAmplitude * speedFactor
        const waveOffset = Math.sin(time * 3 + i * 0.5) * waveAmplitude
        tailPositions[i].add(perp.clone().multiplyScalar(waveOffset))
        followTarget = tailPositions[i].clone()
        if (tailRefs.current[i]) {
          tailRefs.current[i].position.copy(tailPositions[i])
        }
      }
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
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="orange" />
        </mesh>

        {/* Tail Segments */}
        {tailPositions.map((pos, idx) => {
          // Calculate tapering radius for each segment
          const radius = 0.5 * (1 - (idx + 1) / (numSegments + 1))
          return (
            <mesh
              key={idx}
              ref={(el) => (tailRefs.current[idx] = el)}
              position={pos}
            >
              <sphereGeometry args={[radius, 12, 12]} />
              <meshStandardMaterial color="red" />
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
    </>
  )
}

export default Fish 