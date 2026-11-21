import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

const pointer = { x: 0, y: 0 };

function Scene({ dark }: { dark: boolean }) {
  return (
    <>
      <fog attach="fog" args={[dark ? '#070812' : '#f5f2ee', 12, 72]} />
      <Starfield />
    </>
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
