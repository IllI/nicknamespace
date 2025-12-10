# 3D Conversion Print Preparation Components

This directory contains React components for the print preparation and download functionality of the 3D conversion service.

## Components

### PrintPreparation.tsx
A comprehensive component for configuring 3D print settings and validating models for printing.

**Features:**
- Printer selection (Bambu P1P, A1 Mini, Generic FDM)
- Material configuration (PLA, PETG, ABS, TPU)
- Quality presets (Draft, Standard, Fine)
- Model compatibility checking
- Print validation and estimates
- Real-time configuration updates

**Props:**
- `conversionId`: ID of the conversion record
- `modelMetadata`: 3D model metadata from conversion
- `onPrintReady`: Callback when preparation is complete
- `defaultPrinterType`: Default printer selection

### ModelDownload.tsx
Component for downloading 3D models in various formats with printer-specific optimizations.

**Features:**
- Multiple format support (STL, OBJ, PLY)
- Print-ready vs original variants
- OrcaSlicer profile download
- Progress tracking
- Usage instructions
- File size estimates

**Props:**
- `conversionRecord`: Complete conversion record
- `printPreparationResult`: Results from print preparation
- `onDownloadStart/Complete/Error`: Download event callbacks

### PrintWorkflow.tsx
Orchestrates the complete print preparation workflow from configuration to download.

**Features:**
- Step-by-step workflow UI
- Progress tracking
- Error handling
- Workflow reset functionality
- Model information display

**Props:**
- `conversionRecord`: Conversion record to process
- `onWorkflowComplete`: Callback when workflow is finished

## API Integration

### Print Preparation API
`POST /api/3d-conversion/prepare-print/[id]`

Prepares a 3D model for printing with specified printer and material settings.

**Request Body:**
```json
{
  "printer_type": "bambu_p1p",
  "material_type": "PLA", 
  "quality_preset": "standard"
}
```

**Response:**
- Print-ready model URL
- Validation results
- Print estimates
- OrcaSlicer profile URL (for Bambu printers)

### Download API
`GET /api/3d-conversion/download/[id]?format=stl&variant=print-ready&printer=bambu_p1p`

Downloads 3D models in various formats and variants.

**Query Parameters:**
- `format`: File format (stl, obj, ply)
- `variant`: File variant (original, print-ready, repaired)
- `printer`: Printer type for optimizations (bambu_p1p, etc.)

## Usage Example

```tsx
import PrintWorkflow from '@/components/ui/3d-conversion/PrintWorkflow';

function ConversionPage({ conversionRecord }) {
  const handleWorkflowComplete = () => {
    // Handle completion
    console.log('Print preparation complete!');
  };

  return (
    <PrintWorkflow
      conversionRecord={conversionRecord}
      onWorkflowComplete={handleWorkflowComplete}
    />
  );
}
```

## Printer Support

### Bambu Lab P1P
- Build volume: 256×256×256mm
- Supported materials: PLA, PETG, ABS, TPU
- OrcaSlicer profile generation
- Automatic print optimizations

### Bambu Lab A1 Mini  
- Build volume: 180×180×180mm
- Supported materials: PLA, PETG, ABS
- OrcaSlicer profile generation

### Generic FDM
- Configurable build volume
- Basic material support
- Standard STL export

## File Formats

### STL (Print Ready)
- Optimized for 3D printing
- Printer-specific settings applied
- Mesh validation and repair
- Recommended for printing

### OBJ (Editable)
- Wavefront OBJ format
- Suitable for 3D editing software
- Preserves original geometry
- Good for modifications

### PLY (Original)
- Original TripoSR output
- Includes vertex colors
- Highest quality mesh data
- Best for visualization

## Dependencies

- React Three Fiber (3D rendering)
- Tailwind CSS (styling)
- TypeScript (type safety)
- Supabase (file storage)