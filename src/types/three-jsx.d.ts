import { Object3DNode } from '@react-three/fiber'
import * as THREE from 'three'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: Object3DNode<THREE.Group, typeof THREE.Group>
      mesh: Object3DNode<THREE.Mesh, typeof THREE.Mesh>
      ambientLight: Object3DNode<THREE.AmbientLight, typeof THREE.AmbientLight>
      directionalLight: Object3DNode<THREE.DirectionalLight, typeof THREE.DirectionalLight>
      planeGeometry: Object3DNode<THREE.PlaneGeometry, typeof THREE.PlaneGeometry>
      meshStandardMaterial: Object3DNode<THREE.MeshStandardMaterial, typeof THREE.MeshStandardMaterial>
    }
  }
}

// This is needed to fix the TypeScript error for WebkitUserDrag
declare module 'react' {
  interface CSSProperties {
    WebkitUserDrag?: 'none' | 'element' | 'auto'
    draggable?: boolean
  }
} 