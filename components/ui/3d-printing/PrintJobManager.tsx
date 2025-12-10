'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Play, 
  AlertCircle, 
  CheckCircle,
  Info
} from 'lucide-react';
import { 
  PrintSettings, 
  ModelMetadata, 
  PRINT_MATERIALS, 
  PRINT_QUALITIES 
} from '@/lib/types/direct-print-jobs';
import { Button } from '@/components/ui/button';

interface PrintJobManagerProps {
  jobId: string;
  modelMetadata: ModelMetadata;
  onJobSubmitted: () => void;
  onCancel: () => void;
}

const PrintJobManager: React.FC<PrintJobManagerProps> = ({
  jobId,
  modelMetadata,
  onJobSubmitted,
  onCancel
}) => {
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    material: 'PLA',
    quality: 'standard',
    infill: 20,
    supports: false,
    layerHeight: 0.2,
    printSpeed: 50,
    bedTemperature: 60,
    nozzleTemperature: 210
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Update material-specific temperatures
  const updateMaterialSettings = (material: string) => {
    const materialSettings = {
      PLA: { bedTemp: 60, nozzleTemp: 210 },
      PETG: { bedTemp: 80, nozzleTemp: 240 },
      ABS: { bedTemp: 100, nozzleTemp: 250 },
      TPU: { bedTemp: 50, nozzleTemp: 220 }
    };

    const settings = materialSettings[material as keyof typeof materialSettings];
    if (settings) {
      setPrintSettings(prev => ({
        ...prev,
        material: material as any,
        bedTemperature: settings.bedTemp,
        nozzleTemperature: settings.nozzleTemp
      }));
    }
  };

  // Update quality-specific settings
  const updateQualitySettings = (quality: string) => {
    const qualitySettings = {
      draft: { layerHeight: 0.3, printSpeed: 80 },
      standard: { layerHeight: 0.2, printSpeed: 50 },
      fine: { layerHeight: 0.1, printSpeed: 30 }
    };

    const settings = qualitySettings[quality as keyof typeof qualitySettings];
    if (settings) {
      setPrintSettings(prev => ({
        ...prev,
        quality: quality as any,
        layerHeight: settings.layerHeight,
        printSpeed: settings.printSpeed
      }));
    }
  };

  // Validate print settings
  const validateSettings = (): string[] => {
    const warnings: string[] = [];

    // Check if model fits build volume
    if (!modelMetadata.fitsInBuildVolume) {
      warnings.push('Model exceeds build volume - printing may fail');
    }

    // Check for very high infill
    if (printSettings.infill > 80) {
      warnings.push('High infill percentage may increase print time significantly');
    }

    // Check for very fine layer height with large models
    if (printSettings.layerHeight < 0.15 && modelMetadata.dimensions.z > 50) {
      warnings.push('Fine layer height with tall models will take a very long time');
    }

    // Check if supports might be needed
    if (!printSettings.supports && modelMetadata.faces > 10000) {
      warnings.push('Complex models may benefit from support structures');
    }

    return warnings;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    // Validate settings
    const warnings = validateSettings();
    setValidationWarnings(warnings);

    try {
      const response = await fetch('/api/3d-printing/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          printSettings
        }),
      });

      const data = await response.json();

      if (data.success) {
        onJobSubmitted();
      } else {
        setError(data.error?.message || 'Failed to submit print job');
      }
    } catch (err) {
      setError('Network error while submitting job');
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedPrintTime = () => {
    const volume = modelMetadata.dimensions.x * modelMetadata.dimensions.y * modelMetadata.dimensions.z;
    const layers = Math.ceil(modelMetadata.dimensions.z / printSettings.layerHeight);
    const timePerLayer = (60 / printSettings.printSpeed) * 2; // Rough estimate
    const infillMultiplier = 1 + (printSettings.infill / 100);
    const supportMultiplier = printSettings.supports ? 1.3 : 1;
    
    const estimatedMinutes = layers * timePerLayer * infillMultiplier * supportMultiplier;
    return Math.max(30, Math.round(estimatedMinutes));
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Model Info */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h4 className="font-medium text-white mb-3 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Model Information
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-400">Dimensions:</span>
            <span className="text-white ml-2">
              {modelMetadata.dimensions.x.toFixed(1)} × {modelMetadata.dimensions.y.toFixed(1)} × {modelMetadata.dimensions.z.toFixed(1)} mm
            </span>
          </div>
          <div>
            <span className="text-zinc-400">Complexity:</span>
            <span className="text-white ml-2">{modelMetadata.faces.toLocaleString()} faces</span>
          </div>
        </div>
      </div>

      {/* Print Settings */}
      <div className="space-y-4">
        <h4 className="font-medium text-white flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          Print Settings
        </h4>

        {/* Material Selection */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Material
          </label>
          <select
            value={printSettings.material}
            onChange={(e) => updateMaterialSettings(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            {PRINT_MATERIALS.map(material => (
              <option key={material} value={material}>{material}</option>
            ))}
          </select>
        </div>

        {/* Quality Selection */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Quality
          </label>
          <select
            value={printSettings.quality}
            onChange={(e) => updateQualitySettings(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            {PRINT_QUALITIES.map(quality => (
              <option key={quality} value={quality}>
                {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Infill (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={printSettings.infill}
              onChange={(e) => setPrintSettings(prev => ({ ...prev, infill: parseInt(e.target.value) || 0 }))}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Layer Height (mm)
            </label>
            <input
              type="number"
              min="0.1"
              max="0.4"
              step="0.05"
              value={printSettings.layerHeight}
              onChange={(e) => setPrintSettings(prev => ({ ...prev, layerHeight: parseFloat(e.target.value) || 0.2 }))}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Supports Toggle */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="supports"
            checked={printSettings.supports}
            onChange={(e) => setPrintSettings(prev => ({ ...prev, supports: e.target.checked }))}
            className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="supports" className="text-sm font-medium text-zinc-300">
            Generate support structures
          </label>
        </div>
      </div>

      {/* Estimated Print Time */}
      <div className="bg-blue-950/20 border border-blue-500 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-blue-400" />
          <span className="text-blue-300 font-medium">
            Estimated print time: {formatTime(estimatedPrintTime())}
          </span>
        </div>
      </div>

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="bg-yellow-950/20 border border-yellow-500 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 font-medium">Warnings</p>
              <ul className="text-yellow-400 text-sm mt-1 space-y-1">
                {validationWarnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-950/20 border border-red-500 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-medium">Submission Error</p>
              <p className="text-red-400 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Submitting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Submit Print Job
            </>
          )}
        </Button>
        
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default PrintJobManager;