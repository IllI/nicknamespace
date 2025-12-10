'use client';

import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, Box, Zap, Star, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileFormatInfo {
  extension: string;
  name: string;
  description: string;
  support: 'full' | 'conversion' | 'service';
  icon: React.ReactNode;
  pros: string[];
  cons: string[];
  bestFor: string;
  maxSize: string;
}

const FILE_FORMATS: FileFormatInfo[] = [
  {
    extension: 'STL',
    name: 'STereoLithography',
    description: 'The gold standard for 3D printing. Simple mesh format.',
    support: 'full',
    icon: <Box className="w-5 h-5 text-blue-400" />,
    pros: ['Universal 3D printing support', 'Small file size', 'Fast processing'],
    cons: ['No color/texture info', 'No material properties'],
    bestFor: 'Most 3D printing applications',
    maxSize: '100MB'
  },
  {
    extension: '3MF',
    name: '3D Manufacturing Format',
    description: 'Microsoft\'s modern 3D printing format with advanced features.',
    support: 'service',
    icon: <Star className="w-5 h-5 text-purple-400" />,
    pros: ['Includes materials & colors', 'Supports multiple objects', 'Industry standard'],
    cons: ['Requires conversion', 'Limited preview'],
    bestFor: 'Professional 3D printing workflows',
    maxSize: '100MB'
  },
  {
    extension: 'OBJ',
    name: 'Wavefront OBJ',
    description: 'Common 3D model format with material support.',
    support: 'full',
    icon: <Box className="w-5 h-5 text-green-400" />,
    pros: ['Widely supported', 'Material information', 'Human readable'],
    cons: ['Larger file sizes', 'May need cleanup'],
    bestFor: 'Models from 3D software',
    maxSize: '100MB'
  },
  {
    extension: 'PLY',
    name: 'Polygon File Format',
    description: 'Research format good for scanned models.',
    support: 'full',
    icon: <Box className="w-5 h-5 text-yellow-400" />,
    pros: ['Handles complex geometry', 'Color support', 'Efficient storage'],
    cons: ['Less common', 'May need conversion'],
    bestFor: '3D scanned objects',
    maxSize: '100MB'
  },
  {
    extension: 'GLTF/GLB',
    name: 'GL Transmission Format',
    description: 'Modern web-friendly 3D format.',
    support: 'conversion',
    icon: <Zap className="w-5 h-5 text-red-400" />,
    pros: ['Rich materials', 'Animations', 'Web optimized'],
    cons: ['Converted to STL', 'Complex processing'],
    bestFor: 'Web 3D models, game assets',
    maxSize: '100MB'
  },
  {
    extension: 'FBX',
    name: 'Filmbox',
    description: 'Autodesk\'s format for complex 3D scenes.',
    support: 'conversion',
    icon: <Box className="w-5 h-5 text-orange-400" />,
    pros: ['Rich scene data', 'Animation support', 'Industry standard'],
    cons: ['Large files', 'Converted to STL', 'Complex processing'],
    bestFor: 'CAD models, game assets',
    maxSize: '100MB'
  },
  {
    extension: 'DAE',
    name: 'Collada',
    description: 'Open standard for 3D asset exchange.',
    support: 'conversion',
    icon: <Box className="w-5 h-5 text-cyan-400" />,
    pros: ['Open standard', 'Rich metadata', 'Cross-platform'],
    cons: ['XML-based (large)', 'Converted to STL'],
    bestFor: 'Cross-platform 3D exchange',
    maxSize: '100MB'
  },
  {
    extension: 'X3D',
    name: 'Extensible 3D',
    description: 'Web-based 3D graphics standard.',
    support: 'service',
    icon: <Box className="w-5 h-5 text-pink-400" />,
    pros: ['Web standard', 'Interactive features', 'Open format'],
    cons: ['Requires conversion', 'Limited preview'],
    bestFor: 'Web 3D applications',
    maxSize: '100MB'
  },
  {
    extension: 'AMF',
    name: 'Additive Manufacturing File',
    description: 'Advanced format for additive manufacturing.',
    support: 'service',
    icon: <Box className="w-5 h-5 text-indigo-400" />,
    pros: ['Multi-material support', 'Color information', 'Manufacturing focused'],
    cons: ['Requires conversion', 'Less common'],
    bestFor: 'Multi-material printing',
    maxSize: '100MB'
  }
];

const FileFormatGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

  const getSupportBadge = (support: string) => {
    switch (support) {
      case 'full':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-500/30">
            <Star className="w-3 h-3 mr-1" />
            Full Support
          </span>
        );
      case 'conversion':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-500/30">
            <Zap className="w-3 h-3 mr-1" />
            Auto Convert
          </span>
        );
      case 'service':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Service Only
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Info className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-medium text-white">Supported File Formats</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Show Details
            </>
          )}
        </Button>
      </div>

      {!isExpanded ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {FILE_FORMATS.slice(0, 5).map((format) => (
            <div
              key={format.extension}
              className="flex items-center space-x-2 p-2 bg-zinc-800 rounded border border-zinc-600"
            >
              {format.icon}
              <span className="text-sm font-medium text-zinc-200">{format.extension}</span>
            </div>
          ))}
          <div className="flex items-center justify-center p-2 bg-zinc-800 rounded border border-zinc-600 text-zinc-400">
            <span className="text-sm">+4 more</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {FILE_FORMATS.map((format) => (
              <div
                key={format.extension}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedFormat === format.extension
                    ? 'border-blue-500 bg-blue-950/20'
                    : 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'
                }`}
                onClick={() => setSelectedFormat(
                  selectedFormat === format.extension ? null : format.extension
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {format.icon}
                    <div>
                      <h4 className="font-medium text-white">{format.extension}</h4>
                      <p className="text-sm text-zinc-400">{format.name}</p>
                    </div>
                  </div>
                  {getSupportBadge(format.support)}
                </div>
                
                <p className="text-sm text-zinc-300 mb-3">{format.description}</p>
                
                {selectedFormat === format.extension && (
                  <div className="space-y-3 pt-3 border-t border-zinc-600">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-green-400 mb-2">Advantages</h5>
                        <ul className="text-xs text-zinc-300 space-y-1">
                          {format.pros.map((pro, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-green-400 mr-2">•</span>
                              {pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-yellow-400 mb-2">Considerations</h5>
                        <ul className="text-xs text-zinc-300 space-y-1">
                          {format.cons.map((con, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-yellow-400 mr-2">•</span>
                              {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span><strong>Best for:</strong> {format.bestFor}</span>
                      <span><strong>Max size:</strong> {format.maxSize}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-300 mb-2">Support Levels Explained</h4>
            <div className="space-y-2 text-xs text-blue-200">
              <div className="flex items-center space-x-2">
                <Star className="w-3 h-3 text-green-400" />
                <span><strong>Full Support:</strong> Complete validation, preview, and processing</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-3 h-3 text-blue-400" />
                <span><strong>Auto Convert:</strong> Automatically converted to STL for printing</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span><strong>Service Only:</strong> Processed by print service, limited preview</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileFormatGuide;