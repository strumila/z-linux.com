import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const SYSCALLS = [
  'open', 'read', 'write', 'close', 'fork', 'execve', 'mmap', 'brk',
  'ioctl', 'socket', 'bind', 'accept', 'connect', 'poll', 'epoll_wait',
  'futex', 'clone', 'exit', 'sigaction', 'pipe',
];

const R0 = 1.0;
const R3 = 2.4;
const RING0_COLOR = 0xff7a5c;
const RING3_COLOR = 0x4f94d4;
const RING0_CSS = '#ff7a5c';
const RING3_CSS = '#4f94d4';

export default function RingHero() {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getSize = () => ({ w: el.clientWidth, h: el.clientHeight });
    const { w, h } = getSize();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 2.4, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    const lrDom = labelRenderer.domElement;
    lrDom.style.position = 'absolute';
    lrDom.style.top = '0';
    lrDom.style.left = '0';
    lrDom.style.pointerEvents = 'none';
    el.appendChild(lrDom);

    const ring0 = new THREE.Mesh(
      new THREE.TorusGeometry(R0, 0.045, 16, 128),
      new THREE.MeshBasicMaterial({ color: RING0_COLOR }),
    );
    ring0.rotation.x = Math.PI / 2;
    scene.add(ring0);

    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(R3, 0.02, 16, 256),
      new THREE.MeshBasicMaterial({ color: RING3_COLOR }),
    );
    ring3.rotation.x = Math.PI / 2;
    scene.add(ring3);

    const dotsGeom = new THREE.BufferGeometry();
    const N_DOTS = 80;
    const dotPositions = new Float32Array(N_DOTS * 3);
    for (let i = 0; i < N_DOTS; i++) {
      const a = (i / N_DOTS) * Math.PI * 2;
      dotPositions[i * 3 + 0] = Math.cos(a) * R0;
      dotPositions[i * 3 + 1] = 0;
      dotPositions[i * 3 + 2] = Math.sin(a) * R0;
    }
    dotsGeom.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
    const dots = new THREE.Points(
      dotsGeom,
      new THREE.PointsMaterial({ color: RING0_COLOR, size: 0.06, transparent: true, opacity: 0.7 }),
    );
    scene.add(dots);

    const labelGroup = new THREE.Group();
    scene.add(labelGroup);
    SYSCALLS.forEach((name, i) => {
      const div = document.createElement('div');
      div.textContent = name;
      div.style.cssText =
        'font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;' +
        `color:${RING3_CSS};opacity:0.72;white-space:nowrap;letter-spacing:0.02em;`;
      const obj = new CSS2DObject(div);
      const a = (i / SYSCALLS.length) * Math.PI * 2;
      obj.position.set(Math.cos(a) * R3, 0, Math.sin(a) * R3);
      labelGroup.add(obj);
    });

    const makeRingLabel = (text, color) => {
      const div = document.createElement('div');
      div.textContent = text;
      div.style.cssText =
        `font-family:ui-monospace,SFMono-Regular,monospace;font-size:9px;` +
        `color:${color};opacity:0.55;letter-spacing:0.2em;text-transform:uppercase;`;
      return new CSS2DObject(div);
    };
    const r0Label = makeRingLabel('ring 0', RING0_CSS);
    r0Label.position.set(0, 0, R0 + 0.1);
    scene.add(r0Label);
    const r3Label = makeRingLabel('ring 3', RING3_CSS);
    r3Label.position.set(0, 0, R3 + 0.1);
    scene.add(r3Label);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      labelGroup.rotation.y += 0.0018;
      dots.rotation.y -= 0.004;
      ring0.rotation.z += 0.0024;
      ring3.rotation.z -= 0.0014;
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const { w, h } = getSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      ring0.geometry.dispose();
      ring0.material.dispose();
      ring3.geometry.dispose();
      ring3.material.dispose();
      dotsGeom.dispose();
      dots.material.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      if (lrDom.parentNode === el) el.removeChild(lrDom);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '360px',
        overflow: 'hidden',
      }}
    />
  );
}
