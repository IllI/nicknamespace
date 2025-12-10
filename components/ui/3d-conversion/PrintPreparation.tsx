'use client';

import React, { useState, useEffect } from 'react';
import { 
  PrintPreparationProps, 
  PrintPreparationRequest, 
  PrintPreparationResponse,
  ValidationResult,
  PrintEstimates 
} from '@/lib/types/3d-conversion';

interface PrinterConfig {
  name: string;
  buildVolume: { x: number; y: number; z: number };
  materials: string[];
  layerHeights: { draft: number; standard: number; fine: number };
  nozzleDiameter: number;
}

const PRINTER_CONFIGS: Record<string, PrinterConfig> = {
  bambu_p1p: {
    name: 'Bambu Lab P1P',
    buildVolume: { x: 256, y: 256, z: 256 },
    materials: ['PLA', 'PETG', 'ABS', 'TPU'],
    layerHeights: { draft: 0.28, standard: 0.20, fine: 0.12 },
    nozzleDiameter: 0.4
  },
  bambu_a1_mini: {
    name: 'Bambu Lab A1 Mini',
    buildVolume: { x: 180, y: 180, z: 180 },
    materials: ['PLA', 'PETG', 'ABS'],
    layerHeights: { draft: 0.28, standard: 0.20, fine: 0.12 },
    nozzleDiameter: 0.4
  },
  generic_fdm: {
    name: 'Generic FDM Printer',
    buildVolume: { x: 200, y: 200, z: 200 },
    materials: ['PLA', 'PETG', 'ABS'],
    layerHeights: { draft: 0.30, standard: 0.20, fine: 0.15 },
    nozzleDiameter: 0.4
  }
};

const PrintPreparation: React.FC<PrintPreparationProps> = ({
  conversionId,
  modelMetadata,
  onPrintReady,
  defaultPrinterType = 'bambu_p1p'
}) => {
  const [selectedPrinter, setSelectedPrinter] = useState<'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm'>(defaultPrinterType);
  const [selectedMaterial, setSelectedMaterial] = useState<'PLA' | 'PETG' | 'ABS' | 'TPU'>('PLA');
  const [selectedQuality, setSelectedQuality] = useState<'draft' | 'standard' | 'fine'>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [printEstimates, setPrintEstimates] = useState<PrintEstimates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparationComplete, setPreparationComplete] = useState(false);

  const printerConfig = PRINTER_CONFIGS[selectedPrinter];

  // Check model compatibility with selected printer
  const checkCompatibility = () => {
    if (!modelMetadata.dimensions) return null;

    const { x, y, z } = modelMetadata.dimensions;
    const { buildVolume } = printerConfig;
    
    const fitsX = x <= buildVolume.x;
    const fitsY = y <= buildVolume.y;
    const fitsZ = z <= buildVolume.z;
    const fitsOverall = fitsX && fitsY && fitsZ;

    return {
      fitsOverall,
      fitsX,
      fitsY,
      fitsZ,
      scaleNeeded: fitsOverall ? 1 : Math.min(
        buildVolume.x / x,
        buildVolume.y / y,
        buildVolume.z / z
      )
    };
  };

  const compatibility = checkCompatibility();

  // Prepare model for printing
  const handlePreparePrint = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const request: PrintPreparationRequest = {
        printer_type: selectedPrinter,
        material_type: selectedMaterial,
        quality_preset: selectedQuality
      };

      const response = await fetch(`/api/3d-conversion/prepare-print/${conversionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to prepare print: ${response.statusText}`);
      }

      const result: PrintPreparationResponse = await response.json();
      
      setValidationResults(result.validation_results);
      setPrintEstimates(result.print_estimates);
      setPreparationComplete(true);
      
      onPrintReady(result);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare model for printing');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get material properties for display
  const getMaterialProperties = (material: string) => {
    const properties = {
      PLA: { 
        temp: '190-220°C', 
        bed: '50-60°C', 
        difficulty: 'Easy',
        color: 'bg-green-500'
      },
      PETG: { 
        temp: '220-250°C', 
        bed: '70-80°C', 
        difficulty: 'Medium',
        color: 'bg-blue-500'
      },
      ABS: { 
        temp: '240-260°C', 
        bed: '80-100°C', 
        difficulty: 'Hard',
        color: 'bg-orange-500'
      },
      TPU: { 
        temp: '210-230°C', 
        bed: '40-60°C', 
        difficulty: 'Hard',
        color: 'bg-purple-500'
      }
    };
    return properties[material as keyof typeof properties] || properties.PLA;
  };

  return (
    <div className="w-full bg-zinc-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">
          Print Preparation
        </h2>
        <p className="text-zinc-400 text-sm">
          Configure your 3D printer settings and validate the model for printing
        </p>
      </div>

      {/* Model Information */}
      <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
        <h3 className="text-lg font-medium text-zinc-200 mb-3">Model Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-zinc-400">Vertices:</span>
            <div className="text-zinc-200 font-medium">{modelMetadata.vertices?.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-zinc-400">Faces:</span>
            <div className="text-zinc-200 font-medium">{modelMetadata.faces?.toLocaleString()}</div>
          </div>
          {modelMetadata.dimensions && (
            <>
              <div>
                <span className="text-zinc-400">Dimensions:</span>
                <div className="text-zinc-200 font-medium">
                  {modelMetadata.dimensions.x.toFixed(1)} × {modelMetadata.dimensions.y.toFixed(1)} × {modelMetadata.dimensions.z.toFixed(1)} mm
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Status:</span>
                <div className={`font-medium ${modelMetadata.is_manifold ? 'text-green-400' : 'text-yellow-400'}`}>
                  {modelMetadata.is_manifold ? 'Print Ready' : 'Needs Repair'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Printer Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-zinc-200 mb-3">Printer Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Printer Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Printer Type
            </label>
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value as 'bambu_p1p' | 'bambu_a1_mini' | 'generic_fdm')}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {Object.entries(PRINTER_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>

          {/* Material Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Material
            </label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value as 'PLA' | 'PETG' | 'ABS' | 'TPU')}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {printerConfig.materials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>
          </div>

          {/* Quality Preset */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Quality
            </label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value as 'draft' | 'standard' | 'fine')}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="draft">Draft ({printerConfig.layerHeights.draft}mm)</option>
              <option value="standard">Standard ({printerConfig.layerHeights.standard}mm)</option>
              <option value="fine">Fine ({printerConfig.layerHeights.fine}mm)</option>
            </select>
          </div>
        </div>

        {/* Printer Specifications */}
        <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">Build Volume:</span>
              <div className="text-zinc-200">
                {printerConfig.buildVolume.x} × {printerConfig.buildVolume.y} × {printerConfig.buildVolume.z} mm
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Nozzle:</span>
              <div className="text-zinc-200">{printerConfig.nozzleDiameter}mm</div>
            </div>
            <div>
              <span className="text-zinc-400">Layer Height:</span>
              <div className="text-zinc-200">{printerConfig.layerHeights[selectedQuality]}mm</div>
            </div>
            <div>
              <span className="text-zinc-400">Material Temp:</span>
              <div className="text-zinc-200">{getMaterialProperties(selectedMaterial).temp}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Compatibility Check */}
      {compatibility && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-zinc-200 mb-3">Compatibility Check</h3>
          
          <div className={`p-4 rounded-lg ${compatibility.fitsOverall ? 'bg-green-900/30 border border-green-700' : 'bg-yellow-900/30 border border-yellow-700'}`}>
            <div className="flex items-center mb-3">
              <div className={`w-3 h-3 rounded-full mr-2 ${compatibility.fitsOverall ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className={`font-medium ${compatibility.fitsOverall ? 'text-green-400' : 'text-yellow-400'}`}>
                {compatibility.fitsOverall ? 'Model fits in build volume' : 'Model requires scaling'}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className={`${compatibility.fitsX ? 'text-green-400' : 'text-red-400'}`}>
                Width: {modelMetadata.dimensions?.x.toFixed(1)}mm / {printerConfig.buildVolume.x}mm
              </div>
              <div className={`${compatibility.fitsY ? 'text-green-400' : 'text-red-400'}`}>
                Depth: {modelMetadata.dimensions?.y.toFixed(1)}mm / {printerConfig.buildVolume.y}mm
              </div>
              <div className={`${compatibility.fitsZ ? 'text-green-400' : 'text-red-400'}`}>
                Height: {modelMetadata.dimensions?.z.toFixed(1)}mm / {printerConfig.buildVolume.z}mm
              </div>
            </div>
            
            {!compatibility.fitsOverall && (
              <div className="mt-3 text-yellow-400 text-sm">
                Recommended scale: {(compatibility.scaleNeeded * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Material Properties */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-zinc-200 mb-3">Material Properties</h3>
        
        <div className="p-4 bg-zinc-800 rounded-lg">
          <div className="flex items-center mb-3">
            <div className={`w-4 h-4 rounded ${getMaterialProperties(selectedMaterial).color} mr-3`}></div>
            <span className="font-medium text-zinc-200">{selectedMaterial}</span>
            <span className={`ml-auto px-2 py-1 rounded text-xs ${
              getMaterialProperties(selectedMaterial).difficulty === 'Easy' ? 'bg-green-600' :
              getMaterialProperties(selectedMaterial).difficulty === 'Medium' ? 'bg-yellow-600' : 'bg-red-600'
            }`}>
              {getMaterialProperties(selectedMaterial).difficulty}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">Print Temperature:</span>
              <div className="text-zinc-200">{getMaterialProperties(selectedMaterial).temp}</div>
            </div>
            <div>
              <span className="text-zinc-400">Bed Temperature:</span>
              <div className="text-zinc-200">{getMaterialProperties(selectedMaterial).bed}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {validationResults && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-zinc-200 mb-3">Validation Results</h3>
          
          <div className="space-y-3">
            {/* Validation Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`p-3 rounded-lg ${validationResults.is_manifold ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                <div className="text-xs text-zinc-400 mb-1">Manifold</div>
                <div className={`font-medium ${validationResults.is_manifold ? 'text-green-400' : 'text-red-400'}`}>
                  {validationResults.is_manifold ? 'Yes' : 'No'}
                </div>
              </div>
              
              <div className={`p-3 rounded-lg ${!validationResults.has_holes ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                <div className="text-xs text-zinc-400 mb-1">Watertight</div>
                <div className={`font-medium ${!validationResults.has_holes ? 'text-green-400' : 'text-red-400'}`}>
                  {!validationResults.has_holes ? 'Yes' : 'No'}
                </div>
              </div>
              
              <div className={`p-3 rounded-lg ${validationResults.wall_thickness_adequate ? 'bg-green-900/30' : 'bg-yellow-900/30'}`}>
                <div className="text-xs text-zinc-400 mb-1">Wall Thickness</div>
                <div className={`font-medium ${validationResults.wall_thickness_adequate ? 'text-green-400' : 'text-yellow-400'}`}>
                  {validationResults.wall_thickness_adequate ? 'Good' : 'Thin'}
                </div>
              </div>
              
              <div className={`p-3 rounded-lg ${validationResults.fits_build_volume ? 'bg-green-900/30' : 'bg-yellow-900/30'}`}>
                <div className="text-xs text-zinc-400 mb-1">Build Volume</div>
                <div className={`font-medium ${validationResults.fits_build_volume ? 'text-green-400' : 'text-yellow-400'}`}>
                  {validationResults.fits_build_volume ? 'Fits' : 'Scale Needed'}
                </div>
              </div>
            </div>

            {/* Errors and Suggestions */}
            {validationResults.errors.length > 0 && (
              <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
                <div className="text-red-400 font-medium mb-2">Issues Found:</div>
                <ul className="text-red-300 text-sm space-y-1">
                  {validationResults.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResults.repair_suggestions.length > 0 && (
              <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                <div className="text-blue-400 font-medium mb-2">Recommendations:</div>
                <ul className="text-blue-300 text-sm space-y-1">
                  {validationResults.repair_suggestions.map((suggestion, index) => (
                    <li key={index}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print Estimates */}
      {printEstimates && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-zinc-200 mb-3">Print Estimates</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Print Time</div>
              <div className="text-zinc-200 font-medium">
                {Math.floor(printEstimates.print_time_minutes / 60)}h {printEstimates.print_time_minutes % 60}m
              </div>
            </div>
            
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Material Usage</div>
              <div className="text-zinc-200 font-medium">{printEstimates.material_usage_grams}g</div>
            </div>
            
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Estimated Cost</div>
              <div className="text-zinc-200 font-medium">${printEstimates.estimated_cost_usd.toFixed(2)}</div>
            </div>
            
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Layer Count</div>
              <div className="text-zinc-200 font-medium">{printEstimates.layer_count}</div>
            </div>
          </div>
          
          {printEstimates.support_material_grams && printEstimates.support_material_grams > 0 && (
            <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <div className="text-yellow-400 text-sm">
                Support material required: {printEstimates.support_material_grams}g
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="text-red-400 font-medium mb-1">Error</div>
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          {preparationComplete ? 'Model prepared for printing' : 'Configure settings and validate model'}
        </div>
        
        <button
          onClick={handlePreparePrint}
          disabled={isProcessing || preparationComplete}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            preparationComplete
              ? 'bg-green-600 text-white cursor-default'
              : isProcessing
              ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Preparing...
            </div>
          ) : preparationComplete ? (
            'Preparation Complete'
          ) : (
            'Prepare for Printing'
          )}
        </button>
      </div>
    </div>
  );
};

export default PrintPreparation;