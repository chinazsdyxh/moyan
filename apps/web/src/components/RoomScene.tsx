import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SmartRoomMetrics } from '@moyan/contracts';

function CameraRig() {
  const { camera, pointer } = useThree();
  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 6.2 + pointer.x * 0.45, 0.025);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.4 + pointer.y * 0.18, 0.025);
    camera.lookAt(0, 0.85, 0);
  });
  return null;
}

function AirParticles({ humidity }: { humidity: number | null }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 160;
    const data = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      data[index * 3] = (Math.random() - 0.5) * 7.2;
      data[index * 3 + 1] = Math.random() * 3.5 + 0.2;
      data[index * 3 + 2] = (Math.random() - 0.5) * 5.2;
    }
    return data;
  }, []);

  useFrame((state, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.018;
    points.current.position.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.06;
  });

  const opacity = 0.18 + Math.min(0.28, (humidity ?? 45) / 260);
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#7ee7ff" transparent opacity={opacity} depthWrite={false} />
    </points>
  );
}

function SensorBeacon({ position, color, active = true }: { position: [number, number, number]; color: string; active?: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ring.current) return;
    const scale = 1 + Math.sin(state.clock.elapsedTime * 2.1 + position[0]) * 0.08;
    ring.current.scale.setScalar(scale);
    ring.current.rotation.z += 0.004;
  });
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 2.2 : 0.25} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.012, 12, 48]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.55 : 0.16} />
      </mesh>
    </group>
  );
}

function Room({ metrics }: { metrics: SmartRoomMetrics }) {
  const lampOn = metrics.lamp === 'ON';
  const luminance = metrics.luminance ?? 350;
  const lightStrength = lampOn ? Math.min(5.8, 2.8 + luminance / 220) : 0.12;
  const lampGlow = lampOn ? '#ffcc78' : '#27364a';

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#0b1b29" roughness={0.76} metalness={0.16} />
      </mesh>
      <gridHelper args={[8, 16, '#17364a', '#102739']} position={[0, 0.006, 0]} />

      <mesh receiveShadow position={[0, 2.1, -3]}>
        <boxGeometry args={[8, 4.2, 0.09]} />
        <meshStandardMaterial color="#0d1d2b" roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[-4, 2.1, 0]}>
        <boxGeometry args={[0.09, 4.2, 6]} />
        <meshStandardMaterial color="#0a1723" roughness={0.9} />
      </mesh>

      <mesh castShadow receiveShadow position={[0.35, 0.42, 0.25]}>
        <boxGeometry args={[2.8, 0.82, 1.25]} />
        <meshStandardMaterial color="#142b3c" roughness={0.48} metalness={0.34} />
      </mesh>
      <mesh position={[0.35, 0.86, 0.25]}>
        <boxGeometry args={[2.42, 0.06, 0.94]} />
        <meshStandardMaterial color="#56d6dc" emissive="#1e7c86" emissiveIntensity={0.55} roughness={0.22} />
      </mesh>

      <mesh castShadow position={[-2.5, 1.25, -2.65]}>
        <boxGeometry args={[1.8, 2.45, 0.34]} />
        <meshStandardMaterial color="#102636" metalness={0.38} roughness={0.48} />
      </mesh>
      {[0.35, 0.9, 1.45, 2.0].map((height) => (
        <mesh key={height} position={[-2.5, height, -2.42]}>
          <boxGeometry args={[1.5, 0.025, 0.38]} />
          <meshBasicMaterial color="#244d60" />
        </mesh>
      ))}

      <group position={[1.65, 3.45, -0.35]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.34, 0.46, 0.18, 32]} />
          <meshStandardMaterial color="#25384a" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <cylinderGeometry args={[0.28, 0.34, 0.08, 32]} />
          <meshStandardMaterial color={lampGlow} emissive={lampGlow} emissiveIntensity={lampOn ? 4 : 0.12} />
        </mesh>
        <pointLight castShadow color="#ffd89a" intensity={lightStrength} distance={7.5} decay={2} position={[0, -0.32, 0]} />
      </group>

      <mesh position={[2.3, 1.5, -2.91]}>
        <planeGeometry args={[1.8, 1]} />
        <meshStandardMaterial color="#0a2334" emissive="#0a86a2" emissiveIntensity={0.28} />
      </mesh>
      <mesh position={[2.3, 1.5, -2.85]}>
        <planeGeometry args={[1.45, 0.62]} />
        <meshBasicMaterial color="#0e5268" transparent opacity={0.46} />
      </mesh>

      <SensorBeacon position={[-1.65, 1.2, 0.45]} color="#6de7ff" />
      <SensorBeacon position={[2.7, 0.82, 1.65]} color="#a38bff" />
      <SensorBeacon position={[3.05, 2.45, -2.75]} color={lampOn ? '#ffd07a' : '#4a5664'} active={lampOn} />
      <AirParticles humidity={metrics.humidity} />
    </group>
  );
}

export function RoomScene({ metrics }: { metrics: SmartRoomMetrics }) {
  return (
    <div className="room-scene" aria-label="智慧房间三维实时状态">
      <Canvas
        shadows="basic"
        dpr={[1, 1.5]}
        camera={{ position: [6.2, 4.4, 7.6], fov: 42, near: 0.1, far: 80 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        fallback={<div className="room-scene__fallback">当前浏览器未启用 WebGL</div>}
      >
        <color attach="background" args={['#07111f']} />
        <fog attach="fog" args={['#07111f', 8, 18]} />
        <ambientLight intensity={0.62} color="#8fc9dc" />
        <directionalLight castShadow position={[3, 7, 5]} intensity={1.35} color="#b7dfff" shadow-mapSize={[1024, 1024]} />
        <Room metrics={metrics} />
        <CameraRig />
      </Canvas>
      <div className="room-scene__scan" />
      <div className="room-scene__badge">
        <span>LIVE DIGITAL TWIN</span>
        <i />
      </div>
      <div className="room-scene__legend">
        <span><i className="legend-cyan" />环境传感</span>
        <span><i className="legend-violet" />空间感知</span>
        <span><i className="legend-amber" />灯光节点</span>
      </div>
    </div>
  );
}
