<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'

const props = withDefaults(
  defineProps<{
    index: number
    variant?: 'default' | 'title' | 'diagram' | 'code' | 'cta'
  }>(),
  { variant: 'default' }
)

const slides = inject<{ currentSlide: Ref<number> }>('slides')!

const isActive = computed(() => slides.currentSlide.value === props.index)
const isNearby = computed(() => Math.abs(slides.currentSlide.value - props.index) <= 1)
</script>

<template>
  <section
    :class="['slide', `slide--${variant}`, { 'slide--active': isActive }]"
    :aria-hidden="!isActive"
  >
    <div v-if="isNearby" class="slide-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.slide {
  flex-shrink: 0;
  width: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overflow-y: auto;
  padding: 3rem 4rem 5rem;
  opacity: 0;
  transition: opacity 300ms ease;
}
.slide--active {
  opacity: 1;
}
.slide--default {
  justify-content: center;
}
.slide--title,
.slide--cta {
  justify-content: center;
  align-items: center;
  text-align: center;
}
.slide--diagram {
  justify-content: center;
  align-items: center;
}
.slide--code {
  justify-content: center;
}
.slide-content {
  max-width: 56rem;
  width: 100%;
  margin: 0 auto;
  animation: fadeIn 400ms ease;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Typography within slides */
.slide :deep(h1) {
  font-size: 3rem;
  font-weight: 700;
  line-height: 1.2;
  color: #111827;
  margin: 0;
}
.slide :deep(h2) {
  font-size: 2.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 1.5rem;
}
.slide :deep(p) {
  font-size: 1.125rem;
  color: #4b5563;
  line-height: 1.8;
  margin: 0.5rem 0;
}
.slide :deep(.accent) {
  color: #2563eb;
}
.slide :deep(.badge) {
  display: inline-block;
  padding: 0.25rem 1rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
}
.slide :deep(.callout) {
  margin-top: 1.5rem;
  padding: 1rem 1.5rem;
  border-left: 4px solid #f59e0b;
  background: #fffbeb;
  border-radius: 0.5rem;
  font-weight: 500;
  color: #92400e;
}
.slide :deep(.card-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-top: 2rem;
}
.slide :deep(.card) {
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  text-align: center;
}
.slide :deep(.card-icon) {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
.slide :deep(.card h3) {
  font-weight: 600;
  font-size: 1rem;
  color: #111827;
  margin: 0;
}
.slide :deep(.card p) {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}
.slide :deep(.info-box) {
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  margin-top: 0.75rem;
}
.slide :deep(.info-box--green) {
  background: #f0fdf4;
  border-left: 4px solid #22c55e;
}
.slide :deep(.info-box--green h3) {
  color: #166534;
  font-weight: 600;
  margin: 0;
  font-size: 1rem;
}
.slide :deep(.info-box--green p) {
  color: #15803d;
  font-size: 0.875rem;
}
.slide :deep(.info-box--yellow) {
  background: #fefce8;
  border-left: 4px solid #eab308;
}
.slide :deep(.info-box--yellow h3) {
  color: #854d0e;
  font-weight: 600;
  margin: 0;
  font-size: 1rem;
}
.slide :deep(.info-box--yellow p) {
  color: #a16207;
  font-size: 0.875rem;
}
.slide :deep(.info-box--blue) {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
}
.slide :deep(.info-box--blue h3) {
  color: #1e40af;
  font-weight: 600;
  margin: 0;
  font-size: 1rem;
}
.slide :deep(.info-box--blue p) {
  color: #1d4ed8;
  font-size: 0.875rem;
}
.slide :deep(.info-box--red) {
  background: #fef2f2;
  border-left: 4px solid #ef4444;
}
.slide :deep(.info-box--red h3) {
  color: #991b1b;
  font-weight: 600;
  margin: 0;
  font-size: 1rem;
}
.slide :deep(.info-box--red p) {
  color: #b91c1c;
  font-size: 0.875rem;
}
.slide :deep(.code-block) {
  background: #1f2937;
  color: #e5e7eb;
  padding: 1.25rem;
  border-radius: 0.75rem;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  overflow-x: auto;
  line-height: 1.6;
  margin-top: 1.5rem;
}
.slide :deep(.mono-block) {
  background: #f9fafb;
  padding: 1.25rem;
  border-radius: 0.75rem;
  font-family: monospace;
  font-size: 0.85rem;
  text-align: left;
  line-height: 1.8;
  margin-top: 1.5rem;
}
.slide :deep(.module-list) {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.slide :deep(.module-item) {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.625rem;
  border: 1px solid #f3f4f6;
  border-radius: 0.5rem;
}
.slide :deep(.module-item code) {
  flex-shrink: 0;
  background: #f3f4f6;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #374151;
}
.slide :deep(.module-item span) {
  font-size: 0.875rem;
  color: #6b7280;
}
.slide :deep(.sse-list) {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.slide :deep(.sse-item) {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border: 1px solid #f3f4f6;
  border-radius: 0.375rem;
}
.slide :deep(.sse-event) {
  flex-shrink: 0;
  width: 7rem;
  background: #eff6ff;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #1d4ed8;
  text-align: center;
}
.slide :deep(.sse-desc) {
  font-size: 0.875rem;
  color: #6b7280;
}
.slide :deep(.domain-tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.5rem;
}
.slide :deep(.domain-tag) {
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  border-radius: 9999px;
  font-size: 0.875rem;
  color: #374151;
}
.slide :deep(.stack-list) {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.slide :deep(.stack-item) {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}
.slide :deep(.stack-label) {
  flex-shrink: 0;
  width: 7rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}
.slide :deep(.stack-value) {
  color: #111827;
}
.slide :deep(.cta-buttons) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}
.slide :deep(.btn-primary) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 2rem;
  background: #2563eb;
  color: white;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  font-size: 1.125rem;
  transition: background 200ms;
}
.slide :deep(.btn-primary:hover) {
  background: #1d4ed8;
}
.slide :deep(.btn-secondary) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  color: #374151;
  text-decoration: none;
  transition: background 200ms;
}
.slide :deep(.btn-secondary:hover) {
  background: #f9fafb;
}
.slide :deep(.subtitle) {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-top: 1.5rem;
}
.slide :deep(.compare-grid) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 2rem;
  text-align: left;
}
.slide :deep(.compare-bad) {
  padding: 1rem;
  background: #fef2f2;
  border-radius: 0.5rem;
}
.slide :deep(.compare-bad h3) {
  font-weight: 600;
  color: #991b1b;
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.slide :deep(.compare-bad ul) {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: #6b7280;
}
.slide :deep(.compare-good) {
  padding: 1rem;
  background: #f0fdf4;
  border-radius: 0.5rem;
}
.slide :deep(.compare-good h3) {
  font-weight: 600;
  color: #166534;
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.slide :deep(.compare-good ul) {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: #6b7280;
}
.slide :deep(.vocab-grid) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1.5rem;
  text-align: left;
}
.slide :deep(.vocab-card) {
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}
.slide :deep(.vocab-card h4) {
  font-weight: 500;
  color: #111827;
  margin: 0;
  font-size: 0.875rem;
}
.slide :deep(.vocab-card p) {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}
.slide :deep(.roadmap-list) {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}
.slide :deep(.roadmap-item) {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.slide :deep(.roadmap-icon) {
  font-size: 1.125rem;
  margin-top: 0.125rem;
}
.slide :deep(.roadmap-item h4) {
  font-weight: 500;
  color: #111827;
  margin: 0;
  font-size: 0.95rem;
}
.slide :deep(.roadmap-item p) {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0;
}

@media (max-width: 768px) {
  .slide {
    padding: 2rem 1.5rem 5rem;
  }
  .slide :deep(h1) {
    font-size: 2rem;
  }
  .slide :deep(h2) {
    font-size: 1.75rem;
  }
  .slide :deep(.compare-grid),
  .slide :deep(.vocab-grid) {
    grid-template-columns: 1fr;
  }
}
</style>
