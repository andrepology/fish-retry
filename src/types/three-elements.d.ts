import { Object3DNode, extend } from '@react-three/fiber'
import { Mesh, PlaneGeometry, MeshStandardMaterial } from 'three'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: Object3DNode<THREE.AmbientLight, typeof THREE.AmbientLight>
      directionalLight: Object3DNode<THREE.DirectionalLight, typeof THREE.DirectionalLight>
      mesh: Object3DNode<THREE.Mesh, typeof THREE.Mesh>
      planeGeometry: Object3DNode<THREE.PlaneGeometry, typeof THREE.PlaneGeometry>
      meshStandardMaterial: Object3DNode<THREE.MeshStandardMaterial, typeof THREE.MeshStandardMaterial>
    }
  }
}

extend({ Mesh, PlaneGeometry, MeshStandardMaterial }) 