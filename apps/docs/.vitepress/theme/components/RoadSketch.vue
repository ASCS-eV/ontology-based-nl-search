<script setup lang="ts">
import roadSketch from '../assets/cut-in.svg'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <figure class="road-sketch" :class="{ 'road-sketch--compact': compact }">
    <img
      :src="roadSketch"
      width="1000"
      height="300"
      alt="Cut-in illustration: a blue vehicle changes into the lane ahead of a teal ego vehicle. Schematic, not a simulation result."
    />
    <figcaption>
      <span><strong>Ego</strong> — teal vehicle in lower lane</span>
      <span><strong>Cut-in vehicle</strong> — blue vehicle changing from upper lane</span>
      <span>Schematic illustration</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.road-sketch {
  width: 100%;
  margin: 0;
}
.road-sketch img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 24vh;
  object-fit: contain;
}
.road-sketch figcaption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  color: #334155;
  font-size: clamp(24px, 1.9vw, 28px);
  line-height: 1.3;
}
.road-sketch--compact img {
  max-height: 18vh;
}
</style>
