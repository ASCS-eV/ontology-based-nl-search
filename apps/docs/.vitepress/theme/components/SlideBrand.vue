<script setup lang="ts">
// Brand frame of the ASCS brand book (2025): the logo on a blue tab in the
// upper-right corner, a blue and navy footer bar. The logos are the ENVITED-X
// design system's brand assets (`envitedBrand` in
// packages/design-system/src/themes/envited/brand.ts); the web app's public
// directory holds their single published copy, so the deck imports them there.
import euEmblem from '../../../../web/public/logos/funded-by-eu.png'
import envitedLogoWhite from '../../../../web/public/logos/envited-x-white.png'
import synergiesLogo from '../../../../web/public/logos/synergies.svg'
</script>

<template>
  <div class="slide-brand">
    <div class="slide-brand__project">
      <img :src="synergiesLogo" alt="SYNERGIES project" class="slide-brand__logo" />
      <img :src="euEmblem" alt="Funded by the European Union" class="slide-brand__logo" />
    </div>
    <div class="slide-brand__tab">
      <img :src="envitedLogoWhite" alt="ENVITED-X" class="slide-brand__logo" />
    </div>
    <div class="slide-brand__bar slide-brand__bar--blue" aria-hidden="true"></div>
    <div class="slide-brand__bar slide-brand__bar--navy" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.slide-brand {
  --brand-blue: #7891bb;
  --brand-navy: #111727;
  position: fixed;
  inset: 0;
  /* Above the deck (z-index 100), below the slide controls (150). */
  z-index: 120;
  pointer-events: none;
}
.slide-brand__logo {
  display: block;
  height: 40px;
  width: auto;
}
.slide-brand__tab .slide-brand__logo {
  height: 34px;
}
.slide-brand__project {
  position: absolute;
  top: 12px;
  left: 5vw;
  display: flex;
  align-items: center;
  gap: 20px;
}
/* The brand book's logo tab: blue, with an angled left edge. */
.slide-brand__tab {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 5vw 0 72px;
  background: var(--brand-blue);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 44px 100%);
}
/* Footer bars at the edges; the slide controls sit between them. */
.slide-brand__bar {
  position: absolute;
  bottom: 0;
  width: 20vw;
  height: 22px;
}
.slide-brand__bar--blue {
  left: 0;
  background: var(--brand-blue);
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 100%, 0 100%);
}
.slide-brand__bar--navy {
  right: 0;
  background: var(--brand-navy);
  clip-path: polygon(22px 0, 100% 0, 100% 100%, 0 100%);
}
@media (max-width: 700px) {
  .slide-brand__logo {
    height: 22px;
  }
  .slide-brand__tab {
    height: 44px;
    padding-left: 48px;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 30px 100%);
  }
}
</style>
