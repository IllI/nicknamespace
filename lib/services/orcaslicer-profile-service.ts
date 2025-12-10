// OrcaSlicer Profile Generation Service

import { 
  ModelMetadata, 
  PrintMetadata, 
  ValidationResult 
} from '../types/3d-conversion';
import { SupabaseStorageService } from '../utils/supabase-storage';
import { ProcessingError } from '../types/3d-conversion';

interface OrcaSlicerProfile {
  version: string;
  printer_model: string;
  printer_variant: string;
  print_settings: {
    layer_height: number;
    first_layer_height: number;
    perimeters: number;
    top_solid_layers: number;
    bottom_solid_layers: number;
    fill_density: number;
    fill_pattern: string;
    support_material: boolean;
    support_material_threshold: number;
    support_material_pattern: string;
    support_material_spacing: number;
    raft_layers: number;
    brim_width: number;
  };
  filament_settings: {
    filament_type: string;
    bed_temperature: number;
    temperature: number;
    first_layer_bed_temperature: number;
    first_layer_temperature: number;
    fan_always_on: boolean;
    cooling: boolean;
    min_fan_speed: number;
    max_fan_speed: number;
    bridge_fan_speed: number;
    disable_fan_first_layers: number;
  };
  printer_settings: {
    bed_shape: string;
    bed_size: [number, number];
    max_print_height: number;
    nozzle_diameter: number;
    retract_length: number;
    retract_speed: number;
    travel_speed: number;
    first_layer_speed: number;
    perimeter_speed: number;
    small_perimeter_speed: number;
    external_perimeter_speed: number;
    infill_speed: number;
    solid_infill_speed: number;
    top_solid_infill_speed: number;
    support_material_speed: number;
  };
  model_specific: {
    model_id: string;
    estimated_print_time: number;
    estimated_material_usage: number;
    supports_required: boolean;
    recommended_orientation: string;
    scale_factor: number;
  };
}

export class OrcaSlicerProfileService {
  
  /**
   * Generate OrcaSlicer profile for a specific model and printer combination
   */
  static async generateProfile(
    conversionId: string,
    userId: string,
    modelMetadata: ModelMetadata,
    printMetadata: PrintMetadata,
    validationResults: ValidationResult,
    printerType: 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm' = 'bambu_p1p',
    materialType: 'PLA' | 'PETG' | 'ABS' | 'TPU' = 'PLA',
    qualityPreset: 'draft' | 'standard' | 'fine' = 'standard'
  ): Promise<string> {
    try {
      // Generate the profile configuration
      const profile = this.createProfileConfiguration(
        conversionId,
        modelMetadata,
        printMetadata,
        validationResults,
        printerType,
        materialType,
        qualityPreset
      );

      // Convert to JSON
      const profileJson = JSON.stringify(profile, null, 2);
      const profileBuffer = Buffer.from(profileJson, 'utf-8');

      // Upload to storage
      const fileName = `orcaslicer-profile-${printerType}-${materialType}-${qualityPreset}.json`;
      const result = await SupabaseStorageService.uploadFile(
        'MODELS_PRINT_READY',
        userId,
        conversionId,
        fileName,
        profileBuffer,
        'application/json'
      );

      return result.url;

    } catch (error) {
      throw new ProcessingError(
        `Failed to generate OrcaSlicer profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create the profile configuration object
   */
  private static createProfileConfiguration(
    conversionId: string,
    modelMetadata: ModelMetadata,
    printMetadata: PrintMetadata,
    validationResults: ValidationResult,
    printerType: 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm',
    materialType: 'PLA' | 'PETG' | 'ABS' | 'TPU',
    qualityPreset: 'draft' | 'standard' | 'fine'
  ): OrcaSlicerProfile {
    
    const printerConfig = this.getPrinterConfiguration(printerType);
    const materialConfig = this.getMaterialConfiguration(materialType);
    const qualityConfig = this.getQualityConfiguration(qualityPreset);

    // Calculate model-specific settings
    const scaleNeeded = this.calculateRequiredScale(modelMetadata.dimensions, printerConfig.buildVolume);
    const supportsRequired = printMetadata.supports_required || this.analyzeSupportsNeeded(validationResults);
    
    return {
      version: "1.0.0",
      printer_model: printerConfig.model,
      printer_variant: printerConfig.variant,
      
      print_settings: {
        layer_height: qualityConfig.layerHeight,
        first_layer_height: qualityConfig.layerHeight * 1.2, // 20% thicker first layer
        perimeters: this.calculatePerimeters(modelMetadata, materialType),
        top_solid_layers: qualityConfig.topLayers,
        bottom_solid_layers: qualityConfig.bottomLayers,
        fill_density: printMetadata.recommended_infill,
        fill_pattern: this.getInfillPattern(materialType),
        support_material: supportsRequired,
        support_material_threshold: 45, // degrees
        support_material_pattern: "rectilinear",
        support_material_spacing: 2.5,
        raft_layers: 0,
        brim_width: this.calculateBrimWidth(modelMetadata, validationResults)
      },

      filament_settings: {
        filament_type: materialType,
        bed_temperature: materialConfig.bedTemp,
        temperature: materialConfig.printTemp,
        first_layer_bed_temperature: materialConfig.bedTemp + 5,
        first_layer_temperature: materialConfig.printTemp + 5,
        fan_always_on: materialConfig.fanAlwaysOn,
        cooling: materialConfig.cooling,
        min_fan_speed: materialConfig.minFanSpeed,
        max_fan_speed: materialConfig.maxFanSpeed,
        bridge_fan_speed: materialConfig.bridgeFanSpeed,
        disable_fan_first_layers: materialConfig.disableFanFirstLayers
      },

      printer_settings: {
        bed_shape: "rectangular",
        bed_size: [printerConfig.buildVolume.x, printerConfig.buildVolume.y],
        max_print_height: printerConfig.buildVolume.z,
        nozzle_diameter: printerConfig.nozzleDiameter,
        retract_length: printerConfig.retractLength,
        retract_speed: printerConfig.retractSpeed,
        travel_speed: printerConfig.travelSpeed,
        first_layer_speed: qualityConfig.firstLayerSpeed,
        perimeter_speed: qualityConfig.perimeterSpeed,
        small_perimeter_speed: qualityConfig.perimeterSpeed * 0.8,
        external_perimeter_speed: qualityConfig.perimeterSpeed * 0.9,
        infill_speed: qualityConfig.infillSpeed,
        solid_infill_speed: qualityConfig.solidInfillSpeed,
        top_solid_infill_speed: qualityConfig.topSolidInfillSpeed,
        support_material_speed: qualityConfig.supportSpeed
      },

      model_specific: {
        model_id: conversionId,
        estimated_print_time: printMetadata.estimated_print_time_minutes,
        estimated_material_usage: printMetadata.material_usage_grams,
        supports_required: supportsRequired,
        recommended_orientation: this.getRecommendedOrientation(modelMetadata),
        scale_factor: scaleNeeded
      }
    };
  }

  /**
   * Get printer-specific configuration
   */
  private static getPrinterConfiguration(printerType: string) {
    const configs = {
      bambu_p1p: {
        model: "Bambu Lab P1P",
        variant: "0.4mm nozzle",
        buildVolume: { x: 256, y: 256, z: 256 },
        nozzleDiameter: 0.4,
        retractLength: 0.8,
        retractSpeed: 40,
        travelSpeed: 500
      },
      bambu_a1_mini: {
        model: "Bambu Lab A1 Mini",
        variant: "0.4mm nozzle",
        buildVolume: { x: 180, y: 180, z: 180 },
        nozzleDiameter: 0.4,
        retractLength: 0.8,
        retractSpeed: 40,
        travelSpeed: 500
      },
      generic_fdm: {
        model: "Generic FDM",
        variant: "0.4mm nozzle",
        buildVolume: { x: 200, y: 200, z: 200 },
        nozzleDiameter: 0.4,
        retractLength: 1.0,
        retractSpeed: 35,
        travelSpeed: 150
      }
    };

    return configs[printerType as keyof typeof configs] || configs.generic_fdm;
  }

  /**
   * Get material-specific configuration
   */
  private static getMaterialConfiguration(materialType: string) {
    const configs = {
      PLA: {
        printTemp: 210,
        bedTemp: 60,
        fanAlwaysOn: true,
        cooling: true,
        minFanSpeed: 60,
        maxFanSpeed: 100,
        bridgeFanSpeed: 100,
        disableFanFirstLayers: 1
      },
      PETG: {
        printTemp: 235,
        bedTemp: 75,
        fanAlwaysOn: false,
        cooling: true,
        minFanSpeed: 30,
        maxFanSpeed: 50,
        bridgeFanSpeed: 50,
        disableFanFirstLayers: 3
      },
      ABS: {
        printTemp: 250,
        bedTemp: 90,
        fanAlwaysOn: false,
        cooling: false,
        minFanSpeed: 0,
        maxFanSpeed: 30,
        bridgeFanSpeed: 30,
        disableFanFirstLayers: 5
      },
      TPU: {
        printTemp: 220,
        bedTemp: 50,
        fanAlwaysOn: true,
        cooling: true,
        minFanSpeed: 50,
        maxFanSpeed: 80,
        bridgeFanSpeed: 80,
        disableFanFirstLayers: 2
      }
    };

    return configs[materialType as keyof typeof configs] || configs.PLA;
  }

  /**
   * Get quality preset configuration
   */
  private static getQualityConfiguration(qualityPreset: string) {
    const configs = {
      draft: {
        layerHeight: 0.28,
        topLayers: 3,
        bottomLayers: 3,
        firstLayerSpeed: 20,
        perimeterSpeed: 80,
        infillSpeed: 100,
        solidInfillSpeed: 80,
        topSolidInfillSpeed: 60,
        supportSpeed: 80
      },
      standard: {
        layerHeight: 0.20,
        topLayers: 4,
        bottomLayers: 4,
        firstLayerSpeed: 15,
        perimeterSpeed: 60,
        infillSpeed: 80,
        solidInfillSpeed: 60,
        topSolidInfillSpeed: 40,
        supportSpeed: 60
      },
      fine: {
        layerHeight: 0.12,
        topLayers: 5,
        bottomLayers: 5,
        firstLayerSpeed: 10,
        perimeterSpeed: 40,
        infillSpeed: 60,
        solidInfillSpeed: 40,
        topSolidInfillSpeed: 30,
        supportSpeed: 40
      }
    };

    return configs[qualityPreset as keyof typeof configs] || configs.standard;
  }

  /**
   * Calculate required scale factor to fit in build volume
   */
  private static calculateRequiredScale(
    dimensions: { x: number; y: number; z: number },
    buildVolume: { x: number; y: number; z: number }
  ): number {
    const scaleX = buildVolume.x / dimensions.x;
    const scaleY = buildVolume.y / dimensions.y;
    const scaleZ = buildVolume.z / dimensions.z;
    
    const requiredScale = Math.min(scaleX, scaleY, scaleZ);
    return requiredScale > 1 ? 1 : Math.round(requiredScale * 100) / 100;
  }

  /**
   * Calculate optimal number of perimeters based on model complexity
   */
  private static calculatePerimeters(modelMetadata: ModelMetadata, materialType: string): number {
    const basePerimeters = materialType === 'TPU' ? 3 : 2; // TPU needs more perimeters
    
    // Increase perimeters for complex models
    const complexity = modelMetadata.faces / 10000;
    if (complexity > 5) return basePerimeters + 1;
    if (complexity > 2) return basePerimeters;
    
    return Math.max(2, basePerimeters);
  }

  /**
   * Get appropriate infill pattern for material
   */
  private static getInfillPattern(materialType: string): string {
    switch (materialType) {
      case 'TPU': return 'gyroid'; // Better for flexible materials
      case 'ABS': return 'cubic'; // Strong and efficient
      case 'PETG': return 'grid'; // Good balance
      default: return 'cubic'; // PLA default
    }
  }

  /**
   * Calculate brim width based on model characteristics
   */
  private static calculateBrimWidth(
    modelMetadata: ModelMetadata,
    validationResults: ValidationResult
  ): number {
    let brimWidth = 0;
    
    // Add brim for models that don't fit perfectly
    if (!validationResults.fits_build_volume) {
      brimWidth += 3;
    }
    
    // Add brim for models with adhesion issues
    if (modelMetadata.dimensions.z > modelMetadata.dimensions.x * 2) {
      brimWidth += 2; // Tall models need more adhesion
    }
    
    // Small contact area needs brim
    const baseArea = modelMetadata.dimensions.x * modelMetadata.dimensions.y;
    if (baseArea < 100) { // Less than 10cm²
      brimWidth += 5;
    }
    
    return Math.min(brimWidth, 10); // Cap at 10mm
  }

  /**
   * Analyze if supports are needed based on validation results
   */
  private static analyzeSupportsNeeded(validationResults: ValidationResult): boolean {
    // If there are errors related to overhangs or geometry issues
    return validationResults.errors.some(error => 
      error.toLowerCase().includes('overhang') ||
      error.toLowerCase().includes('bridge') ||
      error.toLowerCase().includes('unsupported')
    );
  }

  /**
   * Get recommended print orientation
   */
  private static getRecommendedOrientation(modelMetadata: ModelMetadata): string {
    const { x, y, z } = modelMetadata.dimensions;
    
    // Prefer orientation with largest base area
    const xyArea = x * y;
    const xzArea = x * z;
    const yzArea = y * z;
    
    if (xyArea >= xzArea && xyArea >= yzArea) {
      return "flat_xy"; // Print with XY as base
    } else if (xzArea >= yzArea) {
      return "flat_xz"; // Print with XZ as base
    } else {
      return "flat_yz"; // Print with YZ as base
    }
  }
}