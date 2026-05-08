<script setup lang="ts">
import { computed, inject, type Ref, type ComputedRef } from 'vue'

const slides = inject<{
  currentSlide: Ref<number>
  totalSlides: number
  next: () => void
  prev: () => void
  goTo: (i: number) => void
  isFirst: ComputedRef<boolean>
  isLast: ComputedRef<boolean>
}>('slides')!

const dots = computed(() => Array.from({ length: slides.totalSlides }, (_, i) => i))
</script>

<template>
  <div class="slide-controls">
    <button
      class="nav-btn"
      :disabled="slides.isFirst.value"
      aria-label="Previous slide"
      @click="slides.prev()"
    >
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div class="progress">
      <div class="dots" role="tablist" aria-label="Slides">
        <button
          v-for="i in dots"
          :key="i"
          role="tab"
          :aria-selected="i === slides.currentSlide.value"
          :aria-label="`Slide ${i + 1}`"
          :class="['dot', { 'dot--active': i === slides.currentSlide.value }]"
          @click="slides.goTo(i)"
        />
      </div>
      <span class="counter"> {{ slides.currentSlide.value + 1 }} / {{ slides.totalSlides }} </span>
    </div>

    <button
      class="nav-btn"
      :disabled="slides.isLast.value"
      aria-label="Next slide"
      @click="slides.next()"
    >
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.slide-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  border-top: 1px solid #f3f4f6;
}
.nav-btn {
  padding: 0.5rem;
  border-radius: 9999px;
  border: none;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  transition: all 150ms;
}
.nav-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #374151;
}
.nav-btn:disabled {
  visibility: hidden;
}
.progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.dots {
  display: flex;
  gap: 0.375rem;
}
.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  border: none;
  background: #d1d5db;
  cursor: pointer;
  padding: 0;
  transition: all 300ms;
}
.dot:hover {
  background: #9ca3af;
}
.dot--active {
  width: 1.5rem;
  background: #2563eb;
}
.counter {
  margin-left: 0.5rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: #9ca3af;
}
</style>
