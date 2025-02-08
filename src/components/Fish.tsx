// @ts-nocheck
import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, RootState, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

type Behavior = 'rest' | 'follow' | 'approach'

const Fish: React.FC = () => {
  // Number of tail segments
  const numSegments = 5

  // Get the current mutable mouse and camera objects
  const { mouse, camera, gl } = useThree()

  // Create a ref for the fish head
  const headRef = useRef<THREE.Mesh>(null)

  // For computing head velocity & direction
  const prevHeadPos = useRef(new THREE.Vector3())
  const velocityRef = useRef(new THREE.Vector3())
  const arrowRef = useRef(null)  // we'll create ArrowHelper in useEffect

  // Behavior state
  const [behavior, setBehavior] = useState<Behavior>('rest')
  // For rest behavior, store a fixed target (base position)
  const [restTarget, setRestTarget] = useState(new THREE.Vector3(0, 0, 0))
  // For approach, store the target updated on pointer down
  const [approachTarget, setApproachTarget] = useState(new THREE.Vector3(0, 0, 0))

  // Handle keydown events to switch behavior
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        setBehavior('rest')
        if (headRef.current) {
          setRestTarget(headRef.current.position.clone())
        }
        console.log('Behavior set to rest')
      } else if (event.key.toLowerCase() === 'f') {
        setBehavior('follow')
        console.log('Behavior set to follow')
      } else if (event.key.toLowerCase() === 'a') {
        setBehavior('approach')
        console.log('Behavior set to approach')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Initialize tail segment positions using useMemo so they persist
  const tailPositions = useMemo(() => {
    const arr: THREE.Vector3[] = []
    for (let i = 0; i < numSegments; i++) {
      // Position each tail segment initially a bit behind the head
      arr.push(new THREE.Vector3(0, -(i + 1) * 0.5, 0))
    }
    return arr
  }, [numSegments])

  // Refs for tail segment meshes
  const tailRefs = useRef<(THREE.Mesh | null)[]>([])
  tailRefs.current = new Array(numSegments).fill(null)

  // Create the ArrowHelper (for debugging the head's forward direction)
  useEffect(() => {
    if (headRef.current) {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        headRef.current.position,
        2,
        0x00ffff
      )
      arrowRef.current = arrow
      headRef.current.parent && headRef.current.parent.add(arrow)
    }
  }, [])

  useFrame((state: RootState, delta: number) => {
    // Compute current target based on behavior
    let currentTarget = new THREE.Vector3()
    const time = state.clock.elapsedTime

    if (behavior === 'rest') {
      // In rest mode, use restTarget with a slight bobbing in Y
      const bobbing = Math.sin(time * 3) * 0.1
      currentTarget.copy(restTarget)
      currentTarget.y += bobbing
    } else if (behavior === 'follow') {
      // In follow mode, compute cursor target on XZ plane each frame
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const followTargetCursor = new THREE.Vector3()
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      raycaster.ray.intersectPlane(plane, followTargetCursor)
      followTargetCursor.y = 0  // force on XZ plane
      currentTarget.copy(followTargetCursor)
    } else if (behavior === 'approach') {
      // In approach mode, use the stored approach target (ensure Y=0)
      currentTarget.copy(approachTarget)
      currentTarget.y = 0
    }

    // Update head position by lerping toward the current target
    if (headRef.current) {
      headRef.current.position.lerp(currentTarget, 0.02)
      if (behavior !== 'rest') headRef.current.position.y = 0
      // Compute head velocity for direction computing
      velocityRef.current.copy(headRef.current.position).sub(prevHeadPos.current)
      prevHeadPos.current.copy(headRef.current.position)
    }

    // Compute head forward direction based on velocity (default if nearly still)
    const headDir = new THREE.Vector3()
    if (velocityRef.current.length() > 0.001) {
      headDir.copy(velocityRef.current).normalize()
    } else {
      headDir.set(0, 0, 1)
    }
    // Update debug arrow helper for head direction
    if (arrowRef.current && headRef.current) {
      arrowRef.current.position.copy(headRef.current.position)
      arrowRef.current.setDirection(headDir)
    }

    // Compute a perpendicular direction to head's forward direction on the XZ plane
    const perp = new THREE.Vector3(-headDir.z, 0, headDir.x)
    // Compute speedFactor for wave amplitude scaling
    const speedFactor = THREE.MathUtils.clamp(velocityRef.current.length() * 10, 0.2, 1)

    // Update tail segments
    if (behavior === 'rest') {
      // In rest mode, position tail segments along a straight line behind the head
      for (let i = 0; i < numSegments; i++) {
        // Use headDir (if moving, else default to forward) to position tail segments at fixed spacing
        const spacing = 0.5
        const desiredPos = new THREE.Vector3().copy(headRef.current.position).addScaledVector(headDir, -spacing * (i + 1))
        // Optionally, add a subtle lerp to smooth rapid changes
        tailPositions[i].lerp(desiredPos, 0.2)
        if (tailRefs.current[i]) {
          tailRefs.current[i].position.copy(tailPositions[i])
        }
      }
    } else {
      // In follow/approach mode, use chain-like update with sinusoidal wave offset
      let followTarget = headRef.current ? headRef.current.position.clone() : new THREE.Vector3()
      for (let i = 0; i < numSegments; i++) {
        tailPositions[i].lerp(followTarget, 0.1)
        const baseAmplitude = 0.2 * (1 - i / numSegments)
        const waveAmplitude = baseAmplitude * speedFactor
        const waveOffsetScalar = Math.sin(state.clock.elapsedTime * 3 + i * 0.5) * waveAmplitude
        tailPositions[i].add(new THREE.Vector3().copy(perp).multiplyScalar(waveOffsetScalar))
        followTarget = tailPositions[i].clone()
        if (tailRefs.current[i]) {
          tailRefs.current[i].position.copy(tailPositions[i])
        }
      }
    }
  })

  return (
    <>
      {/* Invisible plane to capture pointer events in approach mode */}
      <mesh
        onPointerDown={(e) => {
          if (behavior === 'approach') {
            // Force Y = 0
            const pt = e.point.clone()
            pt.y = 0
            setApproachTarget(pt)
            console.log('Approach target set:', pt)
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
        {tailPositions.map((pos, idx) => (
          <mesh
            key={idx}
            ref={(el: THREE.Mesh | null) => (tailRefs.current[idx] = el)}
            position={pos}
          >
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshStandardMaterial color="red" />
          </mesh>
        ))}
      </group>
      {/* Debug Overlay showing current behavior and target coordinates */}
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
          Debug - Behavior: {behavior} <br />Target: {(() => {
            let t = new THREE.Vector3()
            if (behavior === 'rest') {
              t.copy(restTarget)
              t.y += Math.sin(Date.now() * 0.003) * 0.1
            } else if (behavior === 'follow') {
              // Recompute cursor target for debug
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
      {/* If in approach mode, display a visible X marker at the approach target */}
      {behavior === 'approach' && (
        <Html position={approachTarget} style={{ pointerEvents: 'none' }}>
          <div style={{ color: 'red', fontSize: '24px', fontWeight: 'bold' }}>X</div>
        </Html>
      )}
    </>
  )
}

export default Fish; 