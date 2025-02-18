import React, { useRef } from 'react';
import * as THREE from 'three';

const Fish: React.FC = () => {
  const headRef = useRef<THREE.Mesh>(null);
  const tailRefs = useRef<THREE.Mesh[]>([]);
  const tailPositions = useRef<THREE.Vector3[]>([]);
  const tailCount = 10;

  return (
    <group>
      {/* Fish Head */}
      <mesh ref={headRef} castShadow>
        <sphereGeometry args={[0.08, 32, 32]} />
        <meshStandardMaterial 
          color="#E0B0FF"
          emissive="#4B0082"
          emissiveIntensity={0.4}
          toneMapped={false}
          shadowSide={THREE.FrontSide}
        />
        <primitive object={new THREE.Object3D()} scale={[1.2, 0.85, 1]} />
      </mesh>

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
            <sphereGeometry args={[radius, 32, 32]} />
            <meshStandardMaterial 
              color={color}
              emissive={color}
              emissiveIntensity={0.3}
              toneMapped={false}
              roughness={0.7}
              metalness={0.1}
              shadowSide={THREE.FrontSide}
            />
            <primitive object={new THREE.Object3D()} scale={[1, verticalScale, 1]} />
          </mesh>
        );
      })}
    </group>
  );
};

export default Fish;
 