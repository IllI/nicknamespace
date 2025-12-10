import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { ValidationResult, DimensionCheck, BUILD_VOLUME_LIMITS } from '@/lib/types/direct-print-jobs';

export class ModelValidator {
  private stlLoader: STLLoader;
  private objLoader: OBJLoader;
  private plyLoader: PLYLoader;
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;
  private colladaLoader: ColladaLoader;

  constructor() {
    this.stlLoader = new STLLoader();
    this.objLoader = new OBJLoader();
    this.plyLoader = new PLYLoader();
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.colladaLoader = new ColladaLoader();
  }

  /**
   * Validates a 3D model file for printability
   */
  async validateFile(file: File): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      format: 'unknown',
      fileSize: file.size,
      modelStats: {
        vertices: 0,
        faces: 0,
        dimensions: { x: 0, y: 0, z: 0 }
      },
      issues: [],
      warnings: [],
      fitsInBuildVolume: false,
      estimatedPrintTime: 0
    };

    try {
      // Determine file format
      const format = this.detectFileFormat(file);
      result.format = format;

      if (format === 'unknown') {
        result.issues.push('Unsupported file format. Please use STL, OBJ, or PLY files.');
        return result;
      }

      // Load and validate the 3D model
      const geometry = await this.loadModel(file, format);
      if (!geometry) {
        result.issues.push('Failed to load 3D model. File may be corrupted.');
        return result;
      }

      // Extract model statistics
      result.modelStats = this.extractModelStats(geometry);

      // Perform validation checks
      const validationChecks = await this.performValidationChecks(geometry, result);
      result.issues = validationChecks.issues;
      result.warnings = validationChecks.warnings;

      // Check build volume
      const dimensionCheck = await this.checkDimensions(geometry);
      result.fitsInBuildVolume = dimensionCheck.fitsInBuildVolume;
      result.modelStats.dimensions = dimensionCheck.dimensions;

      if (!dimensionCheck.fitsInBuildVolume) {
        result.issues.push(
          `Model exceeds build volume (${BUILD_VOLUME_LIMITS.x}×${BUILD_VOLUME_LIMITS.y}×${BUILD_VOLUME_LIMITS.z}mm). ` +
          `Current size: ${dimensionCheck.dimensions.x.toFixed(1)}×${dimensionCheck.dimensions.y.toFixed(1)}×${dimensionCheck.dimensions.z.toFixed(1)}mm`
        );
      }

      // Estimate print time (basic calculation)
      result.estimatedPrintTime = await this.estimatePrintTime(geometry);

      // Determine if model is valid
      result.isValid = result.issues.length === 0;

      // Clean up geometry
      geometry.dispose();

      return result;

    } catch (error) {
      console.error('Model validation error:', error);
      result.issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Checks if model dimensions fit within the build volume
   */
  async checkDimensions(geometry: THREE.BufferGeometry): Promise<DimensionCheck> {
    // Compute bounding box
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;

    if (!boundingBox) {
      return {
        fitsInBuildVolume: false,
        dimensions: { x: 0, y: 0, z: 0 },
        buildVolume: BUILD_VOLUME_LIMITS,
        exceedsLimits: { x: true, y: true, z: true }
      };
    }

    // Calculate dimensions in mm (assuming model is in mm)
    const dimensions = {
      x: boundingBox.max.x - boundingBox.min.x,
      y: boundingBox.max.y - boundingBox.min.y,
      z: boundingBox.max.z - boundingBox.min.z
    };

    // Check if each dimension fits
    const exceedsLimits = {
      x: dimensions.x > BUILD_VOLUME_LIMITS.x,
      y: dimensions.y > BUILD_VOLUME_LIMITS.y,
      z: dimensions.z > BUILD_VOLUME_LIMITS.z
    };

    const fitsInBuildVolume = !exceedsLimits.x && !exceedsLimits.y && !exceedsLimits.z;

    return {
      fitsInBuildVolume,
      dimensions,
      buildVolume: BUILD_VOLUME_LIMITS,
      exceedsLimits
    };
  }

  /**
   * Estimates print time based on model complexity
   */
  async estimatePrintTime(geometry: THREE.BufferGeometry): Promise<number> {
    const stats = this.extractModelStats(geometry);
    
    // Basic estimation based on volume and complexity
    // This is a rough estimate - actual print time depends on many factors
    const volume = stats.dimensions.x * stats.dimensions.y * stats.dimensions.z;
    const complexity = stats.faces / 1000; // Complexity factor based on face count
    
    // Base time calculation (very rough approximation)
    // Assumes 0.2mm layer height and moderate print speed
    const layerHeight = 0.2; // mm
    const layers = Math.ceil(stats.dimensions.z / layerHeight);
    const baseTimePerLayer = 2; // minutes per layer (rough estimate)
    
    const estimatedMinutes = layers * baseTimePerLayer * (1 + complexity * 0.1);
    
    return Math.max(10, Math.round(estimatedMinutes)); // Minimum 10 minutes
  }

  /**
   * Detects the file format based on extension and content
   */
  private detectFileFormat(file: File): '3mf' | 'stl' | 'obj' | 'ply' | 'gltf' | 'glb' | 'fbx' | 'dae' | 'x3d' | 'amf' | 'unknown' {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case '3mf':
        return '3mf';
      case 'stl':
        return 'stl';
      case 'obj':
        return 'obj';
      case 'ply':
        return 'ply';
      case 'gltf':
        return 'gltf';
      case 'glb':
        return 'glb';
      case 'fbx':
        return 'fbx';
      case 'dae':
        return 'dae';
      case 'x3d':
        return 'x3d';
      case 'amf':
        return 'amf';
      default:
        return 'unknown';
    }
  }

  /**
   * Loads a 3D model file and returns the geometry
   */
  private async loadModel(file: File, format: '3mf' | 'stl' | 'obj' | 'ply' | 'gltf' | 'glb' | 'fbx' | 'dae' | 'x3d' | 'amf'): Promise<THREE.BufferGeometry | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          if (!data) {
            reject(new Error('Failed to read file'));
            return;
          }

          switch (format) {
            case 'stl':
              this.loadSTL(data as ArrayBuffer, resolve, reject);
              break;
            case 'obj':
              this.loadOBJ(data as string, resolve, reject);
              break;
            case 'ply':
              this.loadPLY(data as ArrayBuffer, resolve, reject);
              break;
            case 'gltf':
            case 'glb':
              this.loadGLTF(data as ArrayBuffer, resolve, reject);
              break;
            case 'fbx':
              this.loadFBX(data as ArrayBuffer, resolve, reject);
              break;
            case 'dae':
              this.loadCollada(data as string, resolve, reject);
              break;
            case '3mf':
            case 'x3d':
            case 'amf':
              // These formats require specialized loaders not available in Three.js
              // For now, we'll provide basic validation and suggest conversion
              reject(new Error(`${format.toUpperCase()} format detected. Please convert to STL, OBJ, PLY, GLTF, GLB, FBX, or DAE for full validation. File will be processed by the print service.`));
              break;
            default:
              reject(new Error('Unsupported format'));
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));

      // Read file based on format
      if (format === 'obj' || format === 'dae' || format === 'x3d') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  /**
   * Loads STL file
   */
  private loadSTL(data: ArrayBuffer, resolve: (geometry: THREE.BufferGeometry) => void, reject: (error: Error) => void) {
    try {
      const geometry = this.stlLoader.parse(data);
      resolve(geometry);
    } catch (error) {
      reject(new Error(`STL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Loads OBJ file
   */
  private loadOBJ(data: string, resolve: (geometry: THREE.BufferGeometry) => void, reject: (error: Error) => void) {
    try {
      const object = this.objLoader.parse(data);
      
      // Extract geometry from the first mesh found
      let geometry: THREE.BufferGeometry | null = null;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          geometry = child.geometry as THREE.BufferGeometry;
        }
      });

      if (geometry) {
        resolve(geometry);
      } else {
        reject(new Error('No valid geometry found in OBJ file'));
      }
    } catch (error) {
      reject(new Error(`OBJ parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Loads PLY file
   */
  private loadPLY(data: ArrayBuffer, resolve: (geometry: THREE.BufferGeometry) => void, reject: (error: Error) => void) {
    try {
      const geometry = this.plyLoader.parse(data);
      resolve(geometry);
    } catch (error) {
      reject(new Error(`PLY parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Loads GLTF/GLB file
   */
  private loadGLTF(data: ArrayBuffer, resolve: (geometry: THREE.BufferGeometry) => void, reject: (error: Error) => void) {
    try {
      this.gltfLoader.parse(data, '', (gltf) => {
        // Extract geometry from the first mesh found
        let geometry: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            geometry = child.geometry as THREE.BufferGeometry;
          }
        });

        if (geometry) {
          resolve(geometry);
        } else {
          reject(new Error('No valid geometry found in GLTF file'));
        }
      }, (error) => {
        reject(new Error(`GLTF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      });
    } catch (error) {
      reject(new Error(`GLTF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Loads FBX file
   */
  private loadFBX(data: ArrayBuffer, resolve: (geometry: THREE.BufferGeometry) => void, reject: (error: Error) => void) {
    try {
      const object = this.fbxLoader.parse(data, '');
      
      // Extract geometry from the first mesh found
      let geometry: THREE.BufferGeometry | null = null;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          geometry = child.geometry as THREE.BufferGeometry;
        }
      });

      if (geometry) {
        resolve(geometry);
      } else {
        reject(new Error('No valid geometry found in FBX file'));
      }
    } catch (error) {
      reject(new Error(`FBX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Loads Collada (DAE) file
   */
  private loadCollada(data: string, resolve: (geometry: THREE.BufferGeometry) => void, reject: (error: Error) => void) {
    try {
      const result = this.colladaLoader.parse(data, '');
      
      // Extract geometry from the first mesh found
      let geometry: THREE.BufferGeometry | null = null;
      result.scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          geometry = child.geometry as THREE.BufferGeometry;
        }
      });

      if (geometry) {
        resolve(geometry);
      } else {
        reject(new Error('No valid geometry found in Collada file'));
      }
    } catch (error) {
      reject(new Error(`Collada parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Extracts basic statistics from geometry
   */
  private extractModelStats(geometry: THREE.BufferGeometry) {
    const positionAttribute = geometry.getAttribute('position');
    const vertices = positionAttribute ? positionAttribute.count : 0;
    
    // Calculate face count
    const indexAttribute = geometry.getIndex();
    const faces = indexAttribute ? indexAttribute.count / 3 : vertices / 3;

    // Compute bounding box for dimensions
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    
    const dimensions = boundingBox ? {
      x: boundingBox.max.x - boundingBox.min.x,
      y: boundingBox.max.y - boundingBox.min.y,
      z: boundingBox.max.z - boundingBox.min.z
    } : { x: 0, y: 0, z: 0 };

    return {
      vertices: Math.round(vertices),
      faces: Math.round(faces),
      dimensions
    };
  }

  /**
   * Performs various validation checks on the geometry
   */
  private async performValidationChecks(geometry: THREE.BufferGeometry, result: ValidationResult) {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check if geometry has vertices
    const positionAttribute = geometry.getAttribute('position');
    if (!positionAttribute || positionAttribute.count === 0) {
      issues.push('Model has no vertices');
      return { issues, warnings };
    }

    // Check for minimum vertex count
    if (positionAttribute.count < 3) {
      issues.push('Model has insufficient vertices for a valid 3D object');
      return { issues, warnings };
    }

    // Check for normals (important for proper rendering and slicing)
    const normalAttribute = geometry.getAttribute('normal');
    if (!normalAttribute) {
      warnings.push('Model has no normals - may affect print quality');
      // Compute normals if missing
      geometry.computeVertexNormals();
    }

    // Check for very high polygon count
    const faceCount = result.modelStats.faces;
    if (faceCount > 1000000) {
      warnings.push(`Very high polygon count (${faceCount.toLocaleString()} faces) - may slow down slicing`);
    } else if (faceCount > 500000) {
      warnings.push(`High polygon count (${faceCount.toLocaleString()} faces) - consider simplifying for faster processing`);
    }

    // Check for very low polygon count
    if (faceCount < 100) {
      warnings.push('Very low polygon count - model may appear blocky when printed');
    }

    // Check for degenerate triangles (basic check)
    if (this.hasNaNValues(geometry)) {
      issues.push('Model contains invalid geometry (NaN values)');
    }

    // Check for very small dimensions
    const dims = result.modelStats.dimensions;
    if (dims.x < 1 || dims.y < 1 || dims.z < 1) {
      warnings.push('Model is very small - may be difficult to print with fine details');
    }

    // Check for very thin walls (basic check)
    const minDimension = Math.min(dims.x, dims.y, dims.z);
    if (minDimension < 0.4) {
      warnings.push('Model may have very thin walls - minimum recommended thickness is 0.4mm');
    }

    return { issues, warnings };
  }

  /**
   * Checks for NaN values in geometry
   */
  private hasNaNValues(geometry: THREE.BufferGeometry): boolean {
    const positionAttribute = geometry.getAttribute('position');
    if (!positionAttribute) return false;

    const positions = positionAttribute.array;
    for (let i = 0; i < positions.length; i++) {
      if (isNaN(positions[i]) || !isFinite(positions[i])) {
        return true;
      }
    }
    return false;
  }
}

// Utility functions for external use
export const validateModelFile = async (file: File): Promise<ValidationResult> => {
  const validator = new ModelValidator();
  return validator.validateFile(file);
};

export const checkModelDimensions = async (file: File): Promise<DimensionCheck | null> => {
  try {
    const validator = new ModelValidator();
    const format = file.name.split('.').pop()?.toLowerCase() as 'stl' | 'obj' | 'ply';
    
    if (!['stl', 'obj', 'ply'].includes(format)) {
      return null;
    }

    // This is a simplified version that just loads and checks dimensions
    const geometry = await validator['loadModel'](file, format);
    if (!geometry) return null;

    const result = await validator.checkDimensions(geometry);
    geometry.dispose();
    
    return result;
  } catch (error) {
    console.error('Dimension check failed:', error);
    return null;
  }
};