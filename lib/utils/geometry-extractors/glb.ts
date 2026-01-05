import { NodeIO } from '@gltf-transform/core';
import { ConversionError, ProcessingError } from '@/lib/types/3d-conversion';

const io = new NodeIO();

type GeometryData = {
  vertices: Float32Array;
  faces: Uint32Array;
  normals?: Float32Array;
  colors?: Uint8Array;
};

export async function extractGeometryFromGLB(buffer: Buffer): Promise<GeometryData> {
  try {
    const document = await io.readBinary(buffer);
    const meshes = document.getRoot().listMeshes();

    if (meshes.length === 0) {
      throw new ConversionError('GLB file contains no meshes', 'INVALID_MODEL', 400);
    }

    const mesh = meshes[0];
    const primitives = mesh.listPrimitives();

    if (primitives.length === 0) {
      throw new ConversionError('GLB mesh has no primitives to extract', 'INVALID_MODEL', 400);
    }

    const primitive = primitives[0];
    const positionAccessor = primitive.getAttribute('POSITION');

    if (!positionAccessor) {
      throw new ConversionError('GLB primitive is missing POSITION attribute', 'INVALID_MODEL', 400);
    }

    const positionArray = positionAccessor.getArray() as Float32Array | null;

    if (!positionArray || positionArray.length === 0) {
      throw new ConversionError('GLB primitive has empty POSITION data', 'INVALID_MODEL', 400);
    }

    const normalAccessor = primitive.getAttribute('NORMAL');
    const colorAccessor = primitive.getAttribute('COLOR_0');
    const indexAccessor = primitive.getIndices();

    let indices: Uint32Array;
    if (indexAccessor) {
      const indexArray = indexAccessor.getArray();
      if (!indexArray || indexArray.length === 0) {
        throw new ConversionError('GLB primitive has empty indices', 'INVALID_MODEL', 400);
      }
      indices = Uint32Array.from(indexArray as Iterable<number>);
    } else {
      // Generate indices if primitive is non-indexed
      const vertexCount = positionArray.length / 3;
      if (vertexCount % 3 !== 0) {
        throw new ConversionError('Non-indexed GLB primitive is not a triangle list', 'INVALID_MODEL', 400);
      }
      indices = new Uint32Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
      }
    }

    const normals = normalAccessor ? (normalAccessor.getArray() as Float32Array | null) ?? undefined : undefined;
    const colors = colorAccessor ? Uint8Array.from(colorAccessor.getArray() as Iterable<number>) : undefined;

    return {
      vertices: Float32Array.from(positionArray),
      faces: indices,
      normals,
      colors
    };
  } catch (error) {
    if (error instanceof ConversionError) {
      throw error;
    }

    throw new ProcessingError(
      `Failed to extract geometry from GLB: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}
