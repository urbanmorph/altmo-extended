<script lang="ts">
  import { selectedCity } from '$lib/stores/city';
  import { CITIES } from '$lib/config/cities';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  let currentId = $derived($selectedCity?.id ?? '');

  /** Pages that load city-specific data via ?city= param */
  const CITY_PARAM_PAGES = ['/access', '/pulse/transit'];

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const city = CITIES.find(c => c.id === target.value);
    selectedCity.set(city ? { id: city.id, name: city.name, lat: city.lat, lng: city.lng, zoom: city.zoom } : null);

    // Navigate with city param if on a page that supports it
    if (city) {
      const currentPath = page.url.pathname;
      if (CITY_PARAM_PAGES.includes(currentPath)) {
        goto(`${currentPath}?city=${city.id}`);
      }
    }
  }
</script>

<select
  class="rounded-md border-0 bg-white/20 px-3 py-1.5 text-sm text-white
    focus:ring-2 focus:ring-white/50 focus:outline-none"
  value={currentId}
  onchange={handleChange}
>
  <option value="" class="text-earth-900">Select city...</option>
  {#each CITIES as city}
    <option value={city.id} class="text-earth-900">{city.name}</option>
  {/each}
</select>
