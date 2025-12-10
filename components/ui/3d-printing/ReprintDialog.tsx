'use client';

import React, { useState } from 'react';
import { 
  RotateCcw, 
  X, 
  Settings, 
  Printer,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DirectPrintJob, PrintSettings, PRINT_MATERIALS, PRINT_QUALITIES } from '@/lib/types/direct-print-jobs';

interface ReprintDialogProps {
  job: DirectPrintJob;
  isOpen: boolean;
  onClose: () => void;
  onReprint: (jobId: string, printSettings?: Partial<PrintSettings>) => Promise<void>;
}

const ReprintDialog: React.FC<ReprintDialogProps> = ({
  job,
  isOpen,
  onClose,
  onReprint
}) => {
  const [printSettings, setPrintSettings] = useState<Partial<PrintSettings>>(
    job.print_settings || {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onReprint(job.id, printSettings);
      setSuccess(true);
      
      // Close dialog after short delay to show success
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reprint job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettingChange = (key: keyof PrintSettings, value: any) => {
    setPrintSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetToOriginal = () => {
    setPrintSettings(job.print_settings || {});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center space-x-3">
            <RotateCcw className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Reprint Model</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Job Info */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-3">Original Job Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-400">Filename:</span>
                <div className="text-white font-medium">{job.filename}</div>
              </div>
              <div>
                <span className="text-zinc-400">File Size:</span>
                <div className="text-white">{(job.file_size_bytes / (1024 * 1024)).toFixed(2)} MB</div>
              </div>
              <div>
                <span className="text-zinc-400">Created:</span>
                <div className="text-white">{new Date(job.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span className="text-zinc-400">Status:</span>
                <div className={`font-medium ${
                  job.status === 'complete' ? 'text-green-400' : 
                  job.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Print Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Print Settings</span>
              </h3>
              <Button
                onClick={resetToOriginal}
                variant="outline"
                size="sm"
                disabled={isSubmitting}
              >
                Reset to Original
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Material */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Material
                </label>
                <select
                  value={printSettings.material || 'PLA'}
                  onChange={(e) => handleSettingChange('material', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  disabled={isSubmitting}
                >
                  {PRINT_MATERIALS.map(material => (
                    <option key={material} value={material}>{material}</option>
                  ))}
                </select>
              </div>

              {/* Quality */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Print Quality
                </label>
                <select
                  value={printSettings.quality || 'standard'}
                  onChange={(e) => handleSettingChange('quality', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  disabled={isSubmitting}
                >
                  {PRINT_QUALITIES.map(quality => (
                    <option key={quality} value={quality}>
                      {quality.charAt(0).toUpperCase() + quality.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Infill */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Infill Percentage
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={printSettings.infill || 20}
                    onChange={(e) => handleSettingChange('infill', parseInt(e.target.value))}
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <span className="text-white font-medium w-12 text-right">
                    {printSettings.infill || 20}%
                  </span>
                </div>
              </div>

              {/* Supports */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Support Structures
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="supports"
                      checked={printSettings.supports === true}
                      onChange={() => handleSettingChange('supports', true)}
                      className="text-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-white">Enabled</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="supports"
                      checked={printSettings.supports === false}
                      onChange={() => handleSettingChange('supports', false)}
                      className="text-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className="text-white">Disabled</span>
                  </label>
                </div>
              </div>

              {/* Layer Height */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Layer Height (mm)
                </label>
                <select
                  value={printSettings.layerHeight || 0.2}
                  onChange={(e) => handleSettingChange('layerHeight', parseFloat(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  disabled={isSubmitting}
                >
                  <option value={0.1}>0.1mm (Fine)</option>
                  <option value={0.15}>0.15mm (High)</option>
                  <option value={0.2}>0.2mm (Standard)</option>
                  <option value={0.25}>0.25mm (Fast)</option>
                  <option value={0.3}>0.3mm (Draft)</option>
                </select>
              </div>

              {/* Print Speed */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Print Speed (mm/s)
                </label>
                <input
                  type="number"
                  min="20"
                  max="100"
                  step="5"
                  value={printSettings.printSpeed || 50}
                  onChange={(e) => handleSettingChange('printSpeed', parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Temperature Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Nozzle Temperature (°C)
              </label>
              <input
                type="number"
                min="180"
                max="280"
                step="5"
                value={printSettings.nozzleTemperature || 210}
                onChange={(e) => handleSettingChange('nozzleTemperature', parseInt(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Bed Temperature (°C)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={printSettings.bedTemperature || 60}
                onChange={(e) => handleSettingChange('bedTemperature', parseInt(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-950/20 border border-red-500 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-red-300 font-medium">Reprint Failed</p>
                  <p className="text-red-400 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="bg-green-950/20 border border-green-500 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-300 font-medium">Reprint Job Created</p>
                  <p className="text-green-400 text-sm mt-1">
                    Your model has been queued for reprinting with the new settings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-700">
          <div className="text-sm text-zinc-400">
            This will create a new print job using the same model file.
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || success}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Reprint...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Created
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Create Reprint Job
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReprintDialog;