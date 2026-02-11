import { latLngToCell, cellToBoundary, getResolution } from 'h3-js';

export const DEFAULT_RESOLUTION = 8;

export function pointToHex(lat: number, lng: number, resolution = DEFAULT_RESOLUTION): string {
  return latLngToCell(lat, lng, resolution);
}

export function hexToPolygon(h3Index: string): [number, number][] {
  return cellToBoundary(h3Index, true);
}

export function hexResolution(h3Index: string): number {
  return getResolution(h3Index);
}
