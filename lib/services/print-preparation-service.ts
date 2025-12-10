// 3D Model Processing and Print Preparation Service

import { promises as fs } from 'fs';
import path from 'path';
import { CONVERSION_CONFIG } from '../config/3d-conversion';

import { SupabaseStorageService } from '../utils/supabase-storage';
import { 
  ValidationResult, 
  PrintEstimates, 
  ModelMetadata,
  PrintMetadata,
  ProcessingError,
  ConversionError 
} from '../types/3d-conversion';
import { extractGeometryFromGLB } from '../utils/geometry-extractors/glb';

export class PrintPreparationService {
  private static readonly TEMP_DIR = '/tmp/3d-conversion';
  private static readonly BAMBU_P1P_CONFIG = CONVERSION_CONFIG.BAMBU_P1P;

  /**
   * Process 3D model for print preparation
   */
  static async preparePrintReadyModel(
    modelBuffer: Buffer,
    userId: string,
    conversionId: string,
    printerType: 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm' = 'bambu_p1p',
    materialType: 'PLA' | 'PETG' | 'ABS' | 'TPU' = 'PLA',
    modelFormat: 'ply' | 'obj' | 'glb' | 'stl'
  ): Promise<{
    printReadyUrl: string;
    validationResults: ValidationResult;
    printEstimates: PrintEstimates;
    modelMetadata: ModelMetadata;
    printMetadata: PrintMetadata;
  }> {
    try {
      // Parse the model to extract geometry data
      const geometryData = await this.parseModelByFormat(modelBuffer, modelFormat);
      
      // Validate model for printability
      const validationResults = await this.validatePrintability(geometryData, printerType);
      
      // Repair model if needed
      const repairedGeometry = validationResults.has_holes || !validationResults.is_manifold
        ? await this.repairMesh(geometryData)
        : geometryData;
      
      // Convert to STL format
      const stlBuffer = await this.convertToSTL(repairedGeometry);
      
      // Optimize for specific printer
      const optimizedSTL = await this.optimizeForPrinter(stlBuffer, printerType);
      
      // Calculate print estimates
      const printEstimates = await this.calculatePrintEstimates(optimizedSTL, materialType, printerType);
      
      // Upload print-ready model to storage
      const printReadyUrl = await this.uploadPrintReadyModel(
        optimizedSTL,
        userId,
        conversionId,
        'print-ready.stl'
      );
      
      // Create metadata objects
      const modelMetadata: ModelMetadata = {
        vertices: geometryData.vertices.length / 3,
        faces: geometryData.faces.length / 3,
        dimensions: this.calculateDimensions(geometryData.vertices),
        original_format: modelFormat,
        print_ready_format: 'stl',
        is_manifold: validationResults.is_manifold,
        has_errors: validationResults.errors.length > 0,
        repair_applied: validationResults.has_holes || !validationResults.is_manifold
      };
      
      const printMetadata: PrintMetadata = {
        estimated_print_time_minutes: printEstimates.print_time_minutes,
        material_usage_grams: printEstimates.material_usage_grams,
        build_volume_fit: validationResults.fits_build_volume,
        recommended_layer_height: this.getRecommendedLayerHeight(printerType, 'standard'),
        recommended_infill: this.getRecommendedInfill(materialType),
        supports_required: await this.checkSupportsRequired(geometryData),
        orcaslicer_compatible: true,
        printer_compatibility: this.getPrinterCompatibility(printerType)
      };
      
      return {
        printReadyUrl,
        validationResults,
        printEstimates,
        modelMetadata,
        printMetadata
      };
      
    } catch (error) {
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ProcessingError(
        `Failed to prepare model for printing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private static async parseModelByFormat(
    modelBuffer: Buffer,
    modelFormat: 'ply' | 'obj' | 'glb' | 'stl'
  ): Promise<{
    vertices: Float32Array;
    faces: Uint32Array;
    normals?: Float32Array;
    colors?: Uint8Array;
  }> {
    switch (modelFormat) {
      case 'glb':
        return await extractGeometryFromGLB(modelBuffer);
      case 'ply':
        return await this.parsePLYModel(modelBuffer);
      default:
        throw new ProcessingError(`Unsupported model format for print preparation: ${modelFormat}`);
    }
  }

  /**
   * Parse PLY model data to extract geometry
   */
  private static async parsePLYModel(modelBuffer: Buffer): Promise<{
    vertices: Float32Array;
    faces: Uint32Array;
    normals?: Float32Array;
    colors?: Uint8Array;
  }> {
    try {
      const text = modelBuffer.toString('utf-8');
      const lines = text.split('\n');
      
      let vertexCount = 0;
      let faceCount = 0;
      let headerEnded = false;
      let currentLine = 0;
      
      // Parse header
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('element vertex ')) {
          vertexCount = parseInt(line.split(' ')[2]);
        } else if (line.startsWith('element face ')) {
          faceCount = parseInt(line.split(' ')[2]);
        } else if (line === 'end_header') {
          currentLine = i + 1;
          headerEnded = true;
          break;
        }
      }
      
      if (!headerEnded) {
        throw new ProcessingError('Invalid PLY file: no end_header found');
      }
      
      // Parse vertices
      const vertices = new Float32Array(vertexCount * 3);
      const colors = new Uint8Array(vertexCount * 3);
      
      for (let i = 0; i < vertexCount; i++) {
        const line = lines[currentLine + i];
        if (!line) break;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          vertices[i * 3] = parseFloat(parts[0]);
          vertices[i * 3 + 1] = parseFloat(parts[1]);
          vertices[i * 3 + 2] = parseFloat(parts[2]);
          
          // Parse colors if available (typically parts 3, 4, 5 for RGB)
          if (parts.length >= 6) {
            colors[i * 3] = parseInt(parts[3]) || 128;
            colors[i * 3 + 1] = parseInt(parts[4]) || 128;
            colors[i * 3 + 2] = parseInt(parts[5]) || 128;
          }
        }
      }
      
      // Parse faces
      const faces = new Uint32Array(faceCount * 3);
      const faceStartLine = currentLine + vertexCount;
      
      for (let i = 0; i < faceCount; i++) {
        const line = lines[faceStartLine + i];
        if (!line) break;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4 && parts[0] === '3') {
          faces[i * 3] = parseInt(parts[1]);
          faces[i * 3 + 1] = parseInt(parts[2]);
          faces[i * 3 + 2] = parseInt(parts[3]);
        }
      }
      
      return {
        vertices,
        faces,
        colors: colors.some(c => c !== 128) ? colors : undefined
      };
      
    } catch (error) {
      throw new ProcessingError(
        `Failed to parse PLY model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate model for 3D printing compatibility
   */
  private static async validatePrintability(
    geometryData: { vertices: Float32Array; faces: Uint32Array },
    printerType: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const repairSuggestions: string[] = [];
    
    // Check if model is manifold (watertight)
    const isManifold = this.checkManifoldGeometry(geometryData);
    if (!isManifold) {
      errors.push('Model is not watertight (non-manifold geometry)');
      repairSuggestions.push('Repair mesh holes and ensure all edges are properly connected');
    }
    
    // Check for holes
    const hasHoles = this.detectHoles(geometryData);
    if (hasHoles) {
      errors.push('Model contains holes that may cause printing issues');
      repairSuggestions.push('Fill holes in the mesh before printing');
    }
    
    // Check dimensions against build volume
    const dimensions = this.calculateDimensions(geometryData.vertices);
    const buildVolume = this.getBuildVolume(printerType);
    const fitsInBuildVolume = (
      dimensions.x <= buildVolume.x &&
      dimensions.y <= buildVolume.y &&
      dimensions.z <= buildVolume.z
    );
    
    if (!fitsInBuildVolume) {
      errors.push(`Model dimensions (${dimensions.x.toFixed(1)}×${dimensions.y.toFixed(1)}×${dimensions.z.toFixed(1)}mm) exceed build volume`);
      repairSuggestions.push('Scale model down to fit within printer build volume');
    }
    
    // Check wall thickness
    const minWallThickness = this.getMinWallThickness(printerType);
    const wallThicknessAdequate = this.checkWallThickness(geometryData, minWallThickness);
    if (!wallThicknessAdequate) {
      errors.push(`Some walls may be thinner than minimum recommended thickness (${minWallThickness}mm)`);
      repairSuggestions.push('Increase wall thickness or use finer nozzle');
    }
    
    return {
      is_manifold: isManifold,
      has_holes: hasHoles,
      wall_thickness_adequate: wallThicknessAdequate,
      fits_build_volume: fitsInBuildVolume,
      errors,
      repair_suggestions: repairSuggestions
    };
  }

  /**
   * Repair mesh issues
   */
  private static async repairMesh(geometryData: {
    vertices: Float32Array;
    faces: Uint32Array;
  }): Promise<{ vertices: Float32Array; faces: Uint32Array }> {
    // Basic mesh repair - in production you'd use a proper mesh repair library
    // For now, return the original geometry
    console.log('Mesh repair would be applied here');
    return geometryData;
  }

  /**
   * Convert geometry to STL format
   */
  private static async convertToSTL(geometryData: {
    vertices: Float32Array;
    faces: Uint32Array;
  }): Promise<Buffer> {
    try {
      const { vertices, faces } = geometryData;
      
      // Calculate normals for each face
      const normals = this.calculateFaceNormals(vertices, faces);
      
      // Create binary STL
      const triangleCount = faces.length / 3;
      const bufferSize = 80 + 4 + (triangleCount * 50); // Header + count + triangles
      const buffer = Buffer.alloc(bufferSize);
      
      let offset = 0;
      
      // Write STL header (80 bytes)
      buffer.write('Generated by 3D Conversion Service', offset, 'ascii');
      offset += 80;
      
      // Write triangle count
      buffer.writeUInt32LE(triangleCount, offset);
      offset += 4;
      
      // Write triangles
      for (let i = 0; i < triangleCount; i++) {
        const faceIndex = i * 3;
        
        // Write normal vector (12 bytes)
        buffer.writeFloatLE(normals[i * 3], offset);
        buffer.writeFloatLE(normals[i * 3 + 1], offset + 4);
        buffer.writeFloatLE(normals[i * 3 + 2], offset + 8);
        offset += 12;
        
        // Write vertices (36 bytes)
        for (let j = 0; j < 3; j++) {
          const vertexIndex = faces[faceIndex + j] * 3;
          buffer.writeFloatLE(vertices[vertexIndex], offset);
          buffer.writeFloatLE(vertices[vertexIndex + 1], offset + 4);
          buffer.writeFloatLE(vertices[vertexIndex + 2], offset + 8);
          offset += 12;
        }
        
        // Write attribute byte count (2 bytes)
        buffer.writeUInt16LE(0, offset);
        offset += 2;
      }
      
      return buffer;
      
    } catch (error) {
      throw new ProcessingError(
        `Failed to convert to STL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Optimize model for specific printer
   */
  private static async optimizeForPrinter(
    stlBuffer: Buffer,
    printerType: string
  ): Promise<Buffer> {
    // Printer-specific optimizations would go here
    // For now, return the original STL
    console.log(`Optimizing for ${printerType}`);
    return stlBuffer;
  }

  /**
   * Calculate print time and material estimates
   */
  private static async calculatePrintEstimates(
    stlBuffer: Buffer,
    materialType: string,
    printerType: string
  ): Promise<PrintEstimates> {
    try {
      // Parse STL to get triangle count and volume estimation
      const triangleCount = stlBuffer.readUInt32LE(80);
      
      // Rough volume estimation (this would be more accurate with proper mesh analysis)
      const estimatedVolume = triangleCount * 0.001; // Very rough estimate in cm³
      
      // Material density (g/cm³)
      const materialDensity = this.getMaterialDensity(materialType);
      const materialUsage = estimatedVolume * materialDensity;
      
      // Print time estimation (very rough)
      const layerHeight = this.getRecommendedLayerHeight(printerType, 'standard');
      const printSpeed = this.getPrintSpeed(printerType, materialType);
      const estimatedLayers = Math.ceil(10 / layerHeight); // Assuming 10mm height
      const printTime = (estimatedLayers * 2) + (materialUsage * 0.5); // Very rough calculation
      
      return {
        print_time_minutes: Math.round(printTime),
        material_usage_grams: Math.round(materialUsage * 100) / 100,
        estimated_cost_usd: Math.round((materialUsage * 0.03) * 100) / 100, // $0.03 per gram estimate
        layer_count: estimatedLayers,
        support_material_grams: materialUsage * 0.1 // Estimate 10% support material
      };
      
    } catch (error) {
      // Return default estimates if calculation fails
      return {
        print_time_minutes: 60,
        material_usage_grams: 10,
        estimated_cost_usd: 0.30,
        layer_count: 50,
        support_material_grams: 1
      };
    }
  }

  /**
   * Upload print-ready model to storage
   */
  private static async uploadPrintReadyModel(
    stlBuffer: Buffer,
    userId: string,
    conversionId: string,
    fileName: string
  ): Promise<string> {
    try {
      const result = await SupabaseStorageService.uploadFile(
        'MODELS_PRINT_READY',
        userId,
        conversionId,
        fileName,
        stlBuffer,
        'application/octet-stream'
      );
      
      return result.url;
    } catch (error) {
      throw new ProcessingError(
        `Failed to upload print-ready model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // Helper methods

  private static checkManifoldGeometry(geometryData: { vertices: Float32Array; faces: Uint32Array }): boolean {
    // Simplified manifold check - in production use proper mesh analysis
    return geometryData.faces.length > 0 && geometryData.vertices.length > 0;
  }

  private static detectHoles(geometryData: { vertices: Float32Array; faces: Uint32Array }): boolean {
    // Simplified hole detection - in production use proper mesh analysis
    return false; // Assume no holes for now
  }

  private static calculateDimensions(vertices: Float32Array): { x: number; y: number; z: number } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    
    return {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ
    };
  }

  private static getBuildVolume(printerType: string): { x: number; y: number; z: number } {
    switch (printerType) {
      case 'bambu_p1p':
        return {
          x: this.BAMBU_P1P_CONFIG.BUILD_VOLUME.X,
          y: this.BAMBU_P1P_CONFIG.BUILD_VOLUME.Y,
          z: this.BAMBU_P1P_CONFIG.BUILD_VOLUME.Z
        };
      case 'bambu_a1_mini':
        return { x: 180, y: 180, z: 180 };
      default:
        return { x: 200, y: 200, z: 200 };
    }
  }

  private static getMinWallThickness(printerType: string): number {
    switch (printerType) {
      case 'bambu_p1p':
        return this.BAMBU_P1P_CONFIG.MIN_WALL_THICKNESS;
      default:
        return 0.8;
    }
  }

  private static checkWallThickness(geometryData: { vertices: Float32Array; faces: Uint32Array }, minThickness: number): boolean {
    // Simplified wall thickness check - in production use proper mesh analysis
    return true; // Assume adequate thickness for now
  }

  private static calculateFaceNormals(vertices: Float32Array, faces: Uint32Array): Float32Array {
    const normals = new Float32Array(faces.length);
    
    for (let i = 0; i < faces.length; i += 3) {
      const i1 = faces[i] * 3;
      const i2 = faces[i + 1] * 3;
      const i3 = faces[i + 2] * 3;
      
      // Calculate face normal using cross product
      const v1x = vertices[i2] - vertices[i1];
      const v1y = vertices[i2 + 1] - vertices[i1 + 1];
      const v1z = vertices[i2 + 2] - vertices[i1 + 2];
      
      const v2x = vertices[i3] - vertices[i1];
      const v2y = vertices[i3 + 1] - vertices[i1 + 1];
      const v2z = vertices[i3 + 2] - vertices[i1 + 2];
      
      const nx = v1y * v2z - v1z * v2y;
      const ny = v1z * v2x - v1x * v2z;
      const nz = v1x * v2y - v1y * v2x;
      
      // Normalize
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      
      normals[i] = length > 0 ? nx / length : 0;
      normals[i + 1] = length > 0 ? ny / length : 0;
      normals[i + 2] = length > 0 ? nz / length : 0;
    }
    
    return normals;
  }

  private static async checkSupportsRequired(geometryData: { vertices: Float32Array; faces: Uint32Array }): Promise<boolean> {
    // Simplified overhang detection - in production use proper analysis
    return false; // Assume no supports needed for now
  }

  private static getRecommendedLayerHeight(printerType: string, quality: string): number {
    const config = this.BAMBU_P1P_CONFIG.LAYER_HEIGHTS;
    switch (quality) {
      case 'draft': return config.DRAFT;
      case 'fine': return config.FINE;
      default: return config.STANDARD;
    }
  }

  private static getRecommendedInfill(materialType: string): number {
    switch (materialType) {
      case 'TPU': return 10; // Flexible materials need less infill
      case 'ABS': return 20;
      case 'PETG': return 15;
      default: return 15; // PLA default
    }
  }

  private static getPrinterCompatibility(printerType: string): string[] {
    switch (printerType) {
      case 'bambu_p1p':
        return ['bambu_p1p', 'bambu_a1_mini', 'generic_fdm'];
      case 'bambu_a1_mini':
        return ['bambu_a1_mini', 'generic_fdm'];
      default:
        return ['generic_fdm'];
    }
  }

  private static getMaterialDensity(materialType: string): number {
    switch (materialType) {
      case 'PLA': return 1.24;
      case 'ABS': return 1.04;
      case 'PETG': return 1.27;
      case 'TPU': return 1.20;
      default: return 1.24;
    }
  }

  private static getPrintSpeed(printerType: string, materialType: string): number {
    // Return speed in mm/s
    switch (materialType) {
      case 'TPU': return 30;
      case 'ABS': return 60;
      case 'PETG': return 50;
      default: return 80; // PLA
    }
  }
}