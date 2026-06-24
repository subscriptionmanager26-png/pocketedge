import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FINANCIAL_HUBS } from './citiesData';

const GLOBE_RADIUS = 10;
const EARTH_TEXTURE =
  'https://unpkg.com/three-globe/example/img/earth-night.jpg';

const VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D tMap;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec4 texColor = texture2D(tMap, vUv);
    float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    float land = smoothstep(0.015, 0.15, gray) * 0.25;
    float lights = pow(max(gray, 0.0), 3.0) * 8.0;
    vec3 viewDir = normalize(vViewPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float globeOutline = smoothstep(0.68, 0.9, rim) * 0.7;
    vec3 finalColor = vec3(0.0) + vec3(land) + vec3(1.0) * lights + vec3(1.0) * globeOutline;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function createArc(sceneGroup, start, end, heightMultiplier, arcMaterial) {
  const distance = start.distanceTo(end);
  if (distance === 0) return;

  const midPoint = start.clone().lerp(end, 0.5);
  midPoint.normalize().multiplyScalar(GLOBE_RADIUS + distance * heightMultiplier);

  const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
  const points = curve.getPoints(50);
  const curveGeometry = new THREE.BufferGeometry().setFromPoints(points);
  sceneGroup.add(new THREE.Line(curveGeometry, arcMaterial));
}

export default function GlobeHero() {
  const canvasHostRef = useRef(null);
  const labelsHostRef = useRef(null);

  useEffect(() => {
    const container = canvasHostRef.current;
    const labelsContainer = labelsHostRef.current;
    if (!container || !labelsContainer) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 28;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const sceneGroup = new THREE.Group();
    scene.add(sceneGroup);

    const updateGlobePosition = () => {
      if (window.innerWidth < 768) {
        sceneGroup.position.set(0, -10.5, 0);
        sceneGroup.rotation.x = 0.2;
        sceneGroup.rotation.y = 1.0;
      } else {
        sceneGroup.position.set(9.5, -2.0, 0);
        sceneGroup.rotation.x = 0.35;
        sceneGroup.rotation.y = 1.37;
      }
    };
    updateGlobePosition();

    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: null } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    new THREE.TextureLoader().load(
      EARTH_TEXTURE,
      (texture) => {
        earthMaterial.uniforms.tMap.value = texture;
        earthMaterial.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    sceneGroup.add(
      new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64), earthMaterial)
    );

    const allNodes = [];
    const labeledNodes = [];
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    FINANCIAL_HUBS.forEach((city) => {
      const position = latLonToVector3(city.lat, city.lon, GLOBE_RADIUS + 0.01);
      const nodeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      nodeMesh.position.copy(position);
      sceneGroup.add(nodeMesh);

      const labelElement = document.createElement('div');
      labelElement.className = 'pe-globe-city-label';
      labelElement.textContent = city.name;
      labelsContainer.appendChild(labelElement);

      const nodeObj = { position, element: labelElement };
      allNodes.push(nodeObj);
      labeledNodes.push(nodeObj);
    });

    for (let i = 0; i < 100; i += 1) {
      const lat = (Math.random() - 0.2) * 120;
      const lon = (Math.random() - 0.5) * 360;
      const position = latLonToVector3(lat, lon, GLOBE_RADIUS + 0.01);
      allNodes.push({ position });

      const minorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), nodeMaterial);
      minorMesh.position.copy(position);
      sceneGroup.add(minorMesh);
    }

    const arcMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < labeledNodes.length; i += 1) {
      for (let j = i + 1; j < labeledNodes.length; j += 1) {
        if (Math.random() > 0.82) {
          createArc(
            sceneGroup,
            labeledNodes[i].position,
            labeledNodes[j].position,
            0.25,
            arcMaterial
          );
        }
      }
    }

    allNodes.forEach((node, i) => {
      if (i < labeledNodes.length) return;

      let closestHub = null;
      let minDistance = Infinity;
      labeledNodes.forEach((hub) => {
        const dist = node.position.distanceTo(hub.position);
        if (dist < minDistance) {
          minDistance = dist;
          closestHub = hub;
        }
      });

      if (closestHub && Math.random() > 0.4) {
        createArc(sceneGroup, node.position, closestHub.position, 0.15, arcMaterial);
      }

      if (Math.random() > 0.85) {
        const randomTarget = allNodes[Math.floor(Math.random() * allNodes.length)];
        if (
          randomTarget !== node &&
          node.position.distanceTo(randomTarget.position) < GLOBE_RADIUS * 1.2
        ) {
          createArc(sceneGroup, node.position, randomTarget.position, 0.1, arcMaterial);
        }
      }
    });

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 200;
    const posArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i += 1) {
      posArray[i] = (Math.random() - 0.5) * 50;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMesh = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(particlesMesh);

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let frameId = 0;

    const onMouseDown = () => {
      isDragging = true;
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.offsetX - previousMousePosition.x;
        const deltaY = e.offsetY - previousMousePosition.y;
        sceneGroup.rotation.y += deltaX * 0.005;
        sceneGroup.rotation.x += deltaY * 0.005;
      }
      previousMousePosition = { x: e.offsetX, y: e.offsetY };
    };

    const onTouchStart = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => {
      isDragging = false;
    };
    const onTouchMove = (e) => {
      if (isDragging) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        sceneGroup.rotation.y += deltaX * 0.005;
        sceneGroup.rotation.x += deltaY * 0.005;
      }
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('touchstart', onTouchStart);
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchmove', onTouchMove);

    const vector = new THREE.Vector3();

    const updateLabels = () => {
      labeledNodes.forEach((node) => {
        vector.copy(node.position);
        vector.applyMatrix4(sceneGroup.matrixWorld);

        const cameraToNode = vector.clone().sub(camera.position).normalize();
        const normal = vector.clone().normalize();

        vector.project(camera);
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

        node.element.style.left = `${x}px`;
        node.element.style.top = `${y}px`;
        node.element.style.opacity = cameraToNode.dot(normal) > -0.1 ? '0' : '1';
      });
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      updateGlobePosition();
    };

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!isDragging) {
        sceneGroup.rotation.y += 0.0003;
      }
      particlesMesh.rotation.y -= 0.0001;
      renderer.render(scene, camera);
      updateLabels();
    };

    window.addEventListener('resize', onResize);
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchmove', onTouchMove);
      labelsContainer.innerHTML = '';
      renderer.dispose();
      container.innerHTML = '';
    };
  }, []);

  return (
    <>
      <div ref={canvasHostRef} className="pe-globe-canvas" aria-hidden />
      <div ref={labelsHostRef} className="pe-globe-labels" aria-hidden />
    </>
  );
}
