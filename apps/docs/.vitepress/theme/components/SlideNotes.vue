<script setup lang="ts">
defineProps<{
  index: number
  title: string
  timing: string
}>()
</script>

<template>
  <div
    class="slide-notes-source"
    :data-slide-note="index"
    :data-title="title"
    :data-timing="timing"
    hidden
    aria-hidden="true"
  >
    <slot />
  </div>
</template>
