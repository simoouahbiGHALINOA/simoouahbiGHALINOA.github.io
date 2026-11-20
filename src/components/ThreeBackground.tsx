import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere } from '@react-three/drei';

const pointer = { x: 0, y: 0 };

function Scene({ dark }: { dark: boolean }) {
  return (
    <>
      <ambientLight intensity={dark ? 0.42 : 0.82} />
      <pointLight position={[10, 10, 10]} color="#3657ff" intensity={1.2} />
      <pointLight position={[-10, -8, -8]} color="#5e31d7" intensity={0.9} />
      <spotLight position={[0, 5, 0]} angle={0.35} penumbra={1} intensity={dark ? 1.4 : 0.9} />
      <fog attach="fog" args={[dark ? '#070812' : '#f5f2ee', 12, 72]} />
      <Planet dark={dark} />
      <Starfield />
    </>
  );
}

function Planet({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    const smooth = 1 - Math.exp(-Math.min(delta, 0.1) * 3);
    const x = 1 + pointer.x * 0.2 + Math.sin(t * 0.4) * 0.06;
    const y = -1.1 + pointer.y * 0.18 + Math.cos(t * 0.3) * 0.05;
    group.current.position.x += (x - group.current.position.x) * smooth;
    group.current.position.y += (y - group.current.position.y) * smooth;
    group.current.position.z = -0.8;
    group.current.rotation.y = t * 0.08;
    group.current.rotation.x = Math.sin(t * 0.2) * 0.08;
  });

  return (
    <group ref={group}>
      <Sphere args={[1.15, 64, 64]}>
        <MeshDistortMaterial
          color={dark ? '#160f2c' : '#e8e4ed'}
          emissive={dark ? '#1328ad' : '#405bd4'}
          emissiveIntensity={dark ? 0.28 : 0.12}
          transparent
          opacity={dark ? 0.42 : 0.2}
          distort={0.34}
          speed={1.6}
          roughness={0.28}
          metalness={0.8}
        />
      </Sphere>
      <mesh rotation={[0.62, 0.2, -0.3]}>
        <torusGeometry args={[1.62, 0.012, 8, 160]} />
        <meshBasicMaterial color={dark ? '#5869fa' : '#5663a5'} transparent opacity={0.52} />
      </mesh>
    </group>
  );
}

function Starfield() {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = 6000;
  const { positions, scales } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 42;
      scales[i] = Math.random() * 0.018 + 0.004;
    }
    return { positions, scales };
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!mesh.current) return;
    for (let i = 0; i < count; i += 1) {
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.scale.setScalar(scales[i]);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [dummy, positions, scales]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const smooth = 1 - Math.exp(-delta * 5);
    group.current.rotation.y = clock.elapsedTime * 0.018;
    group.current.rotation.x = clock.elapsedTime * 0.009;
    group.current.position.x += (-pointer.x * 0.35 - group.current.position.x) * smooth;
    group.current.position.y += (-pointer.y * 0.35 - group.current.position.y) * smooth;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshBasicMaterial color="#b9c4ff" transparent opacity={0.85} />
      </instancedMesh>
    </group>
  );
}

class CanvasFallback extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <div className="canvas-fallback" aria-hidden="true" /> : this.props.children;
  }
}

export default function ThreeBackground({ theme }: { theme: 'dark' | 'light' }) {
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = -(event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  return (
    <div className="three-background" aria-hidden="true">
      <CanvasFallback>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power', stencil: false }}
          camera={{ position: [0, 0, 5], fov: 60 }}
          style={{ pointerEvents: 'none', background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <Scene dark={theme === 'dark'} />
          </Suspense>
        </Canvas>
      </CanvasFallback>
    </div>
  );
}
