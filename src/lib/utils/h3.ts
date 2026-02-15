import { latLngToCell, cellToBoundary, cellToLatLng, getResolution } from 'h3-js';
import type { DensityCell } from '$lib/server/activity-data';

export const DEFAULT_RESOLUTION = 10;

export function pointToHex(lat: number, lng: number, resolution = DEFAULT_RESOLUTION): string {
  return latLngToCell(lat, lng, resolution);
}

export function hexToPolygon(h3Index: string): [number, number][] {
  return cellToBoundary(h3Index, true);
}

export function hexResolution(h3Index: string): number {
  return getResolution(h3Index);
}

/**
 * Convert H3 density cells to a GeoJSON FeatureCollection of polygons.
 * Each feature has properties: total, rides, walks for MapLibre data-driven styling.
 */
export function densityToGeoJSON(cells: DensityCell[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const cell of cells) {
    try {
      const boundary = cellToBoundary(cell.h3_index, true); // [lng, lat] format
      // Close the polygon ring
      const ring = [...boundary, boundary[0]];

      features.push({
        type: 'Feature',
        properties: {
          h3: cell.h3_index,
          total: cell.total,
          rides: cell.rides,
          walks: cell.walks
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring]
        }
      });
    } catch {
      // Invalid H3 index — skip
    }
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Convert H3 density cells to a GeoJSON FeatureCollection of points (centroids).
 * Used for MapLibre heatmap layer — each point is weighted by activity count.
 */
export function densityToPointGeoJSON(cells: DensityCell[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const cell of cells) {
    try {
      const [lat, lng] = cellToLatLng(cell.h3_index);
      features.push({
        type: 'Feature',
        properties: {
          total: cell.total,
          rides: cell.rides,
          walks: cell.walks
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });
    } catch {
      // Invalid H3 index — skip
    }
  }

  return { type: 'FeatureCollection', features };
}
