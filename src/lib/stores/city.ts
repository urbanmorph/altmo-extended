import { writable } from 'svelte/store';

export interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
}

// Default to Bengaluru (first city with transit data)
export const selectedCity = writable<City | null>({
  id: 'bengaluru',
  name: 'Bengaluru',
  lat: 12.9716,
  lng: 77.5946,
  zoom: 12
});
