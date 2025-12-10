'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Model3DPreviewProps {
  modelUrl?: string;
  filename: string;
  modelMetadata?: {
    format: 'stl' | 'obj' | 'ply';
    dimensions: { x: number; y: number; z: number };
    vertices: number;
    faces: number;
  };
  className?: string;
  showControls?: boolean;
  autoRotate?: boolean;
}

const Model3DPreview: React.FC<Model3DPreviewProps> = ({
  modelUrl,
  filename,
  modelMetadata,
  className = '',
  showControls = true,
  autoRotate = false
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Initialize Three.js scene
  const initScene = () => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(50, 50, 50);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-50, -50, -50);
    scene.add(directionalLight2);

    // Grid
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Add renderer to DOM
    mountRef.current.appendChild(renderer.domElement);

    // Start render loop
    animate();
  };

  // Animation loop
  const animate = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    animationIdRef.current = requestAnimationFrame(animate);

    if (controlsRef.current) {
      controlsRef.current.update();
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };

  // Load 3D model
  const loadModel = async (url: string) => {
    if (!sceneRef.current || !modelMetadata) return;

    setLoading(true);
    setError(null);

    try {
      let loader: STLLoader | OBJLoader | PLYLoader;
      
      switch (modelMetadata.format) {
        case 'stl':
          loader = new STLLoader();
          break;
        case 'obj':
          loader = new OBJLoader();
          break;
        case 'ply':
          loader = new PLYLoader();
          break;
        default:
          throw new Error(`Unsupported format: ${modelMetadata.format}`);
      }

      const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
        loader.load(
          url,
          (result) => {
            if (result instanceof THREE.BufferGeometry) {
              resolve(result);
            } else if (result instanceof THREE.Group) {
              // For OBJ files, extract geometry from the group
              const mesh = result.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
              if (mesh && mesh.geometry) {
                resolve(mesh.geometry as THREE.BufferGeometry);
              } else {
                reject(new Error('No valid geometry found in model'));
              }
            } else {
              reject(new Error('Unexpected model format'));
            }
          },
          undefined,
          (error) => reject(error)
        );
      });

      // Remove existing model
      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
      }

      // Create material
      const material = new THREE.MeshLambertMaterial({ 
        color: 0x00aaff,
        wireframe: showWireframe
      });

      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Center the model
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      mesh.position.sub(center);

      // Scale model to fit in view
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 40 / maxDim; // Scale to fit in a 40-unit cube
      mesh.scale.setScalar(scale);

      sceneRef.current.add(mesh);
      modelRef.current = mesh;

      // Adjust camera to fit model
      if (cameraRef.current && controlsRef.current) {
        const distance = maxDim * 1.5;
        cameraRef.current.position.set(distance, distance, distance);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }

      setModelLoaded(true);
    } catch (err) {
      console.error('Model loading error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load 3D model');
    } finally {
      setLoading(false);
    }
  };

  // Handle window resize
  const handleResize = () => {
    if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  };

  // Control functions
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    cameraRef.current.position.set(50, 50, 50);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const zoomIn = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.multiplyScalar(0.8);
  };

  const zoomOut = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.multiplyScalar(1.25);
  };

  const toggleWireframe = () => {
    if (!modelRef.current) return;
    
    const mesh = modelRef.current as THREE.Mesh;
    if (mesh.material instanceof THREE.MeshLambertMaterial) {
      mesh.material.wireframe = !showWireframe;
      setShowWireframe(!showWireframe);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Initialize scene on mount
  useEffect(() => {
    initScene();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Load model when URL changes
  useEffect(() => {
    if (modelUrl && modelMetadata) {
      loadModel(modelUrl);
    }
  }, [modelUrl, modelMetadata]);

  // Update wireframe when toggled
  useEffect(() => {
    if (modelRef.current) {
      const mesh = modelRef.current as THREE.Mesh;
      if (mesh.material instanceof THREE.MeshLambertMaterial) {
        mesh.material.wireframe = showWireframe;
      }
    }
  }, [showWireframe]);

  return (
    <div className={`relative bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden ${className}`}>
      {/* 3D Viewport */}
      <div 
        ref={mountRef} 
        className={`w-full ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'h-96'}`}
        style={{ minHeight: isFullscreen ? '100vh' : '384px' }}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="flex items-center space-x-3 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading 3D model...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-red-950/80 border border-red-500 rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h3 className="text-red-300 font-medium">Preview Error</h3>
            </div>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <Button
              onClick={() => modelUrl && loadModel(modelUrl)}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* No Model Overlay */}
      {!modelUrl && !loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-zinc-400">
            <div className="w-16 h-16 bg-zinc-700 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium mb-2">3D Model Preview</p>
            <p className="text-sm">Model preview will appear here</p>
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="sm"
            className="bg-black/50 border-zinc-600"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          
          {modelLoaded && (
            <>
              <Button
                onClick={resetCamera}
                variant="outline"
                size="sm"
                className="bg-black/50 border-zinc-600"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={zoomIn}
                variant="outline"
                size="sm"
                className="bg-black/50 border-zinc-600"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={zoomOut}
                variant="outline"
                size="sm"
                className="bg-black/50 border-zinc-600"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={toggleWireframe}
                variant="outline"
                size="sm"
                className="bg-black/50 border-zinc-600"
              >
                {showWireframe ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Model Info */}
      {modelMetadata && (
        <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 text-sm text-white">
          <div className="font-medium mb-1">{filename}</div>
          <div className="text-zinc-300 space-y-1">
            <div>Format: {modelMetadata.format.toUpperCase()}</div>
            <div>Vertices: {modelMetadata.vertices.toLocaleString()}</div>
            <div>Faces: {modelMetadata.faces.toLocaleString()}</div>
            <div>
              Size: {modelMetadata.dimensions.x.toFixed(1)} × {modelMetadata.dimensions.y.toFixed(1)} × {modelMetadata.dimensions.z.toFixed(1)} mm
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Model3DPreview;