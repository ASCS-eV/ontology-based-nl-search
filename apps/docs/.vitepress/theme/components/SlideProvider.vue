<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref } from 'vue'

const props = defineProps<{
  totalSlides: number
  initialSlide?: number
}>()

const emit = defineEmits<{
  complete: []
}>()

const currentSlide = ref(props.initialSlide ?? 0)

function next() {
  if (currentSlide.value >= props.totalSlides - 1) {
    emit('complete')
    return
  }
  currentSlide.value++
}

function prev() {
  currentSlide.value = Math.max(0, currentSlide.value - 1)
}

function goTo(index: number) {
  currentSlide.value = Math.max(0, Math.min(props.totalSlides - 1, index))
}

const isFirst = computed(() => currentSlide.value === 0)
const isLast = computed(() => currentSlide.value === props.totalSlides - 1)

provide('slides', {
  currentSlide,
  totalSlides: props.totalSlides,
  next,
  prev,
  goTo,
  isFirst,
  isLast,
})

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  switch (e.key) {
    case 'ArrowRight':
    case ' ':
      e.preventDefault()
      next()
      break
    case 'ArrowLeft':
      e.preventDefault()
      prev()
      break
    case 'Home':
      e.preventDefault()
      goTo(0)
      break
    case 'End':
      e.preventDefault()
      goTo(props.totalSlides - 1)
      break
  }
}

let startX = 0
let startY = 0

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  startX = touch.clientX
  startY = touch.clientY
}

function onTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return
  const deltaX = touch.clientX - startX
  const deltaY = touch.clientY - startY
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
    if (deltaX < 0) next()
    else prev()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchend', onTouchEnd)
})
</script>

<template>
  <slot />
</template>
