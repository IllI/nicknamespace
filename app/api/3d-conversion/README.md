# 3D Conversion API Routes

This directory contains the API routes for the 3D image-to-model conversion service.

## Endpoints

### POST /api/3d-conversion/upload
**Purpose**: Upload an image file and initiate 3D model conversion

**Features**:
- User authentication validation
- Rate limiting based on subscription tier
- File format and size validation
- Background processing initiation
- Conversion record creation

**Request**: FormData with `image` field
**Response**: `{ conversion_id, status, message }`

### GET /api/3d-conversion/status/[id]
**Purpose**: Get conversion status and progress

**Features**:
- Real-time status tracking
- Progress percentage calculation
- Error reporting
- User ownership verification

**Response**: Detailed conversion status with metadata

### POST /api/3d-conversion/status/[id]
**Purpose**: Control conversion (retry/cancel)

**Actions**:
- `retry`: Restart failed conversion
- `cancel`: Cancel ongoing conversion

### GET /api/3d-conversion/download/[id]
**Purpose**: Download generated 3D model files

**Query Parameters**:
- `format`: stl, obj, ply
- `variant`: original, print-ready
- `printer`: bambu_p1p, bambu_a1_mini, generic_fdm

**Features**:
- Format conversion
- Printer-specific optimizations
- Secure file serving

### POST /api/3d-conversion/prepare-print/[id]
**Purpose**: Prepare model for 3D printing

**Request Body**:
```json
{
  "printer_type": "bambu_p1p",
  "material_type": "PLA", 
  "quality_preset": "standard"
}
```

**Features**:
- Model validation for printability
- Print time and material estimates
- Printer-specific optimizations
- OrcaSlicer profile generation (planned)

### GET /api/3d-conversion/prepare-print/[id]
**Purpose**: Get print preparation information and options

## Authentication

All endpoints require user authentication via Supabase Auth. The user session is validated using the server-side Supabase client.

## Rate Limiting

- **Free tier**: 5 conversions per day
- **Premium tier**: 50 conversions per day  
- **Enterprise tier**: 1000 conversions per day

## Error Handling

All endpoints implement comprehensive error handling with appropriate HTTP status codes:
- 400: Bad Request (validation errors)
- 401: Unauthorized (authentication required)
- 404: Not Found (conversion not found)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error

## File Processing

The API handles the complete conversion workflow:
1. Image upload and validation
2. TripoSR API integration for 3D generation
3. Model processing and optimization
4. Print preparation and validation
5. File storage and serving

## Dependencies

- Next.js App Router
- Supabase (auth, database, storage)
- Custom conversion services
- File validation utilities