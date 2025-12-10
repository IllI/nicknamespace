'use client';

import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper.js';
import * as THREE from 'three';
import { Model3DPreviewProps, ModelMetadata } from '@/lib/types/3d-conversion';

interface ModelViewerProps {
  modelUrl: string;
  format: 'ply' | 'obj' | 'stl' | 'glb';
  wireframe: boolean;
  autoRotate: boolean;
  onModelLoad?: (metadata: Partial<ModelMetadata>) => void;
  materialColor?: string;
  showNormals?: boolean;
}

// Component to load and display the 3D model
const ModelViewer: React.FC<ModelViewerProps> = ({ 
  modelUrl, 
  format, 
  wireframe, 
  autoRotate,
  onModelLoad,
  materialColor = '#8b5cf6',
  showNormals = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Load the model based on format
  useEffect(() => {
    const loadModel = async () => {
      try {
        let loadedGeometry: THREE.BufferGeometry;

        if (format === 'ply') {
          const loader = new PLYLoader();
          loadedGeometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
            loader.load(
              modelUrl,
              (geometry) => resolve(geometry),
              undefined,
              (error) => reject(error)
            );
          });
        } else if (format === 'obj') {
          const loader = new OBJLoader();
          const object = await new Promise<THREE.Group>((resolve, reject) => {
            loader.load(
              modelUrl,
              (obj) => resolve(obj),
              undefined,
              (error) => reject(error)
            );
          });
          
          // Extract geometry from the first mesh in the object
          const mesh = object.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
          if (mesh && mesh.geometry) {
            loadedGeometry = mesh.geometry;
          } else {
            throw new Error('No valid geometry found in OBJ file');
          }
        } else if (format === 'glb') {
          const loader = new GLTFLoader();
          const gltf = await new Promise<any>((resolve, reject) => {
            loader.load(
              modelUrl,
              (gltf) => resolve(gltf),
              undefined,
              (error) => reject(error)
            );
          });
          
          // Extract geometry from the first mesh in the scene
          let foundGeometry: THREE.BufferGeometry | null = null;
          gltf.scene.traverse((child: any) => {
            if (child.isMesh && child.geometry && !foundGeometry) {
              foundGeometry = child.geometry;
            }
          });
          
          if (foundGeometry) {
            loadedGeometry = foundGeometry;
          } else {
            throw new Error('No valid geometry found in GLB file');
          }
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }

        // Compute normals if they don't exist
        if (!loadedGeometry.attributes.normal) {
          loadedGeometry.computeVertexNormals();
        }

        // Center and scale the geometry
        loadedGeometry.computeBoundingBox();
        const boundingBox = loadedGeometry.boundingBox!;
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        
        // Center the geometry
        loadedGeometry.translate(-center.x, -center.y, -center.z);
        
        // Scale to fit in a unit cube
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (maxDimension > 0) {
          const scale = 2 / maxDimension;
          loadedGeometry.scale(scale, scale, scale);
        }

        setGeometry(loadedGeometry);

        // Extract metadata
        const vertices = loadedGeometry.attributes.position?.count || 0;
        const faces = loadedGeometry.index ? loadedGeometry.index.count / 3 : vertices / 3;
        
        onModelLoad?.({
          vertices,
          faces,
          dimensions: {
            x: size.x,
            y: size.y,
            z: size.z
          }
        });

      } catch (error) {
        console.error('Error loading 3D model:', error);
      }
    };

    if (modelUrl) {
      loadModel();
    }
  }, [modelUrl, format, onModelLoad]);

  // Auto-rotation animation
  useFrame((state, delta) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  if (!geometry) {
    return null;
  }

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial 
          color={materialColor} 
          wireframe={wireframe}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Show normals helper if enabled */}
      {showNormals && meshRef.current && (
        <primitive object={new VertexNormalsHelper(meshRef.current, 0.1, 0x00ff00)} />
      )}
    </group>
  );
};

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#374151" wireframe />
  </mesh>
);

// Main Model3DPreview component
const Model3DPreview: React.FC<Model3DPreviewProps> = ({
  modelUrl,
  format,
  onAccept,
  onReject,
  showControls = true,
  autoRotate = false
}) => {
  const [wireframe, setWireframe] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);
  const [modelMetadata, setModelMetadata] = useState<Partial<ModelMetadata> | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [lightingIntensity, setLightingIntensity] = useState(1);
  const [showNormals, setShowNormals] = useState(false);
  const [materialColor, setMaterialColor] = useState('#8b5cf6');

  const handleModelLoad = (metadata: Partial<ModelMetadata>) => {
    setModelMetadata(metadata);
  };

  const handleAccept = () => {
    setShowAcceptDialog(false);
    onAccept();
  };

  const handleReject = () => {
    setShowRejectDialog(false);
    onReject();
  };

  return (
    <div className="w-full h-full bg-zinc-900 rounded-lg overflow-hidden">
      {/* 3D Canvas */}
      <div className="relative w-full h-96">
        <Canvas className="w-full h-full">
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          
          {/* Lighting */}
          <ambientLight intensity={0.4 * lightingIntensity} />
          <directionalLight position={[10, 10, 5]} intensity={lightingIntensity} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5 * lightingIntensity} />
          
          {/* Environment for better reflections */}
          <Environment preset="studio" />
          
          {/* Controls */}
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={isAutoRotating}
            autoRotateSpeed={2}
          />
          
          {/* Model */}
          <Suspense fallback={<LoadingFallback />}>
            <ModelViewer
              modelUrl={modelUrl}
              format={format}
              wireframe={wireframe}
              autoRotate={false} // We handle this via OrbitControls
              onModelLoad={handleModelLoad}
              materialColor={materialColor}
              showNormals={showNormals}
            />
          </Suspense>
        </Canvas>

        {/* Loading overlay */}
        {!modelMetadata && (
          <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-2"></div>
              <p className="text-zinc-400 text-sm">Loading 3D model...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Panel */}
      {showControls && (
        <div className="p-4 bg-zinc-800 border-t border-zinc-700">
          {/* Model Information */}
          {modelMetadata && (
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-400">Vertices:</span>
                <span className="ml-2 text-zinc-200">{modelMetadata.vertices?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-zinc-400">Faces:</span>
                <span className="ml-2 text-zinc-200">{modelMetadata.faces?.toLocaleString()}</span>
              </div>
              {modelMetadata.dimensions && (
                <>
                  <div>
                    <span className="text-zinc-400">Width:</span>
                    <span className="ml-2 text-zinc-200">{modelMetadata.dimensions.x.toFixed(2)}mm</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Height:</span>
                    <span className="ml-2 text-zinc-200">{modelMetadata.dimensions.y.toFixed(2)}mm</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Depth:</span>
                    <span className="ml-2 text-zinc-200">{modelMetadata.dimensions.z.toFixed(2)}mm</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* View Controls */}
          <div className="space-y-4 mb-4">
            {/* Primary Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setWireframe(!wireframe)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    wireframe 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  Wireframe
                </button>
                
                <button
                  onClick={() => setIsAutoRotating(!isAutoRotating)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    isAutoRotating 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  Auto Rotate
                </button>

                <button
                  onClick={() => setShowNormals(!showNormals)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    showNormals 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  Normals
                </button>
              </div>

              <div className="text-xs text-zinc-500">
                Click and drag to rotate • Scroll to zoom • Right-click to pan
              </div>
            </div>

            {/* Advanced Controls */}
            <div className="grid grid-cols-2 gap-4">
              {/* Lighting Control */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-400">Lighting Intensity</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={lightingIntensity}
                    onChange={(e) => setLightingIntensity(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 w-8">{lightingIntensity.toFixed(1)}</span>
                </div>
              </div>

              {/* Material Color */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-400">Material Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={materialColor}
                    onChange={(e) => setMaterialColor(e.target.value)}
                    className="w-8 h-8 rounded border border-zinc-600 bg-zinc-700 cursor-pointer"
                  />
                  <div className="flex space-x-1">
                    {['#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#3b82f6'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setMaterialColor(color)}
                        className="w-6 h-6 rounded border border-zinc-600"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Accept/Reject Buttons */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => setShowRejectDialog(true)}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Reject Model
            </button>
            
            <button
              onClick={() => setShowAcceptDialog(true)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Accept Model
            </button>
          </div>
        </div>
      )}

      {/* Accept Confirmation Dialog */}
      {showAcceptDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">
              Accept 3D Model
            </h3>
            <p className="text-zinc-400 mb-4">
              Are you satisfied with this 3D model? Accepting will proceed to print preparation.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAcceptDialog(false)}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">
              Reject 3D Model
            </h3>
            <p className="text-zinc-400 mb-4">
              Are you sure you want to reject this model? You'll be able to upload a different image.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRejectDialog(false)}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Model3DPreview;