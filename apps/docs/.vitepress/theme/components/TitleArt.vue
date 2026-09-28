<!-- Title visual after the ASCS brand book (2025) cover: a hexagon framed by a
     blue and a navy bracket. Instead of the cover's licensed stock photo, the
     hexagon shows the talk's demo scenario: a vehicle in the neighbouring lane
     cuts in ahead of the ego vehicle. The cover's green bar is left out, since
     over a road it would read as part of the scene. -->
<template>
  <svg
    class="title-art"
    viewBox="0 0 520 520"
    role="img"
    aria-label="Schematic: a vehicle in the neighbouring lane cuts in ahead of the ego vehicle"
  >
    <defs>
      <clipPath id="title-art-hexagon">
        <polygon points="250,75 401.6,162.5 401.6,337.5 250,425 98.4,337.5 98.4,162.5" />
      </clipPath>
      <marker
        id="title-art-arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="4"
        markerHeight="4"
        orient="auto-start-reverse"
      >
        <path d="M0 0 L10 5 L0 10 Z" fill="#60ac24" />
      </marker>
    </defs>
    <polygon
      points="250,75 401.6,162.5 401.6,337.5 250,425 98.4,337.5 98.4,162.5"
      fill="#111727"
      stroke="#111727"
      stroke-width="36"
      stroke-linejoin="round"
    />
    <g clip-path="url(#title-art-hexagon)">
      <rect x="170" y="40" width="160" height="440" fill="#1c2438" />
      <line x1="170" y1="40" x2="170" y2="480" stroke="#c5cac8" stroke-width="4" />
      <line x1="330" y1="40" x2="330" y2="480" stroke="#c5cac8" stroke-width="4" />
      <line
        x1="250"
        y1="40"
        x2="250"
        y2="480"
        stroke="#c5cac8"
        stroke-width="4"
        stroke-dasharray="18 16"
      />
      <path
        d="M210 262 C210 222 290 218 290 176"
        fill="none"
        stroke="#60ac24"
        stroke-width="5"
        stroke-dasharray="10 8"
        marker-end="url(#title-art-arrow)"
      />
      <rect x="194" y="262" width="32" height="54" rx="8" fill="#60ac24" />
      <rect x="274" y="318" width="32" height="54" rx="8" fill="#7891bb" />
    </g>
    <polyline
      points="300,48 440,128 440,262"
      fill="none"
      stroke="#7891bb"
      stroke-width="26"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <polyline
      points="62,262 62,372 150,423"
      fill="none"
      stroke="#111727"
      stroke-width="22"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.title-art {
  display: block;
  width: 100%;
  height: auto;
  max-height: 52vh;
}
</style>
