<script lang="ts">
  import { CATCHMENT, TRANSIT_COLORS } from '$lib/utils/transit';
</script>

<div class="space-y-1.5 text-sm">
  <div class="flex items-center gap-2">
    <span
      class="inline-block h-3 w-3 rounded-full border-2"
      style="border-color: {TRANSIT_COLORS.catchmentWalk}; background: transparent;"
    ></span>
    <span class="text-text-primary">Walking ({CATCHMENT.WALK_NEAR}m)</span>
  </div>
  <div class="flex items-center gap-2">
    <span
      class="inline-block h-3 w-3 rounded-full border-2"
      style="border-color: {TRANSIT_COLORS.catchmentWalk}; background: transparent; opacity: 0.6;"
    ></span>
    <span class="text-text-primary">Walking ({CATCHMENT.WALK_FAR}m)</span>
  </div>
  <div class="flex items-center gap-2">
    <span
      class="inline-block h-3 w-3 rounded-full border-2"
      style="border-color: {TRANSIT_COLORS.catchmentCycle}; background: transparent;"
    ></span>
    <span class="text-text-primary">Cycling ({CATCHMENT.CYCLE / 1000}km)</span>
  </div>
</div>
