<script setup lang="ts">
import { type ComputedRef, inject, type Ref } from 'vue'

const slides = inject<{
  currentSlide: Ref<number>
  totalSlides: number
}>('slides')!
</script>

<template>
  <div class="slide-deck">
    <div
      class="slide-track"
      :style="{ transform: `translateX(-${slides.currentSlide.value * 100}%)` }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.slide-deck {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: white;
  z-index: 100;
}
.slide-track {
  display: flex;
  height: 100%;
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
