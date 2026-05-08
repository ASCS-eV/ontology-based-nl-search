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
    :class="[
      'slide',
      `slide--${variant}`,
      { 'slide--active': isActive, 'slide--nearby': isNearby },
    ]"
    :aria-hidden="!isActive"
  >
    <div v-if="isNearby" class="slide-frame">
      <div class="slide-content">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.slide {
  --slide-bg:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 34%),
    radial-gradient(circle at bottom left, rgba(20, 184, 166, 0.08), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  --slide-surface: rgba(255, 255, 255, 0.76);
  --slide-border: rgba(148, 163, 184, 0.22);
  --slide-shadow: 0 34px 80px -50px rgba(15, 23, 42, 0.38);
  --slide-fg: #0f172a;
  --slide-muted: #475569;
  --slide-subtle: #64748b;
  --slide-accent: #0d9488;
  --slide-lead: #1e293b;
  position: relative;
  flex-shrink: 0;
  width: 100%;
  height: 100dvh;
  display: flex;
  align-items: stretch;
  overflow-x: hidden;
  overflow-y: auto;
  padding: clamp(2rem, 4vw, 3.2rem) clamp(1.25rem, 4vw, 4rem) clamp(5.5rem, 9vh, 6.75rem);
  opacity: 0;
  background: var(--slide-bg);
  color: var(--slide-fg);
  transition: opacity 520ms ease;
}

.slide::before,
.slide::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  filter: blur(70px);
  pointer-events: none;
  transition:
    transform 820ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 620ms ease;
}

.slide::before {
  top: -14%;
  right: -10%;
  width: min(42vw, 34rem);
  height: min(42vw, 34rem);
  background: rgba(37, 99, 235, 0.18);
}

.slide::after {
  bottom: -18%;
  left: -10%;
  width: min(34vw, 26rem);
  height: min(34vw, 26rem);
  background: rgba(20, 184, 166, 0.14);
}

.slide--active {
  opacity: 1;
}

.slide--active::before {
  opacity: 0.78;
  transform: translate3d(-1.4%, 0, 0) scale(1.03);
}

.slide--active::after {
  opacity: 0.72;
  transform: translate3d(1.2%, 0, 0) scale(1.02);
}

.slide--title,
.slide--cta {
  --slide-bg:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.24), transparent 32%),
    radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.22), transparent 28%),
    linear-gradient(135deg, #0f172a 0%, #1e293b 62%, #0f766e 100%);
  --slide-surface: linear-gradient(180deg, rgba(15, 23, 42, 0.38) 0%, rgba(15, 23, 42, 0.18) 100%);
  --slide-border: rgba(148, 163, 184, 0.18);
  --slide-shadow: 0 40px 110px -56px rgba(2, 6, 23, 0.9);
  --slide-fg: #f8fafc;
  --slide-muted: rgba(226, 232, 240, 0.92);
  --slide-subtle: rgba(203, 213, 225, 0.84);
  --slide-accent: #5eead4;
  --slide-lead: #ffffff;
  text-align: center;
}

.slide--diagram {
  --slide-bg:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 32%),
    radial-gradient(circle at bottom left, rgba(20, 184, 166, 0.12), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.slide-frame {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
}

.slide-content {
  width: min(1100px, 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(1rem, 1.8vh, 1.35rem);
  padding: clamp(1.6rem, 3vw, 2.75rem);
  border: 1px solid var(--slide-border);
  border-radius: 32px;
  background: var(--slide-surface);
  box-shadow: var(--slide-shadow);
  backdrop-filter: blur(18px);
  opacity: 0;
  transform: translateY(26px) scale(0.985);
  transition:
    opacity 620ms ease,
    transform 760ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 260ms ease;
}

.slide--active .slide-content {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.slide--title .slide-content,
.slide--cta .slide-content {
  width: min(960px, 100%);
  align-items: center;
  padding: clamp(2.2rem, 6vw, 4rem);
}

.slide--diagram .slide-content {
  width: min(1180px, 100%);
}

.slide :deep(h1),
.slide :deep(h2),
.slide :deep(h3),
.slide :deep(h4),
.slide :deep(p),
.slide :deep(ul),
.slide :deep(ol) {
  margin: 0;
}

.slide :deep(h1) {
  font-size: clamp(3.15rem, 7vw, 5.8rem);
  line-height: 0.96;
  letter-spacing: -0.06em;
  font-weight: 800;
  color: var(--slide-fg);
}

.slide :deep(h2) {
  font-size: clamp(2.15rem, 4.5vw, 3.55rem);
  line-height: 1.02;
  letter-spacing: -0.045em;
  font-weight: 750;
  color: var(--slide-fg);
}

.slide :deep(h3) {
  font-size: clamp(1.08rem, 1.4vw, 1.3rem);
  line-height: 1.2;
  font-weight: 700;
  color: var(--slide-fg);
}

.slide :deep(p) {
  font-size: clamp(0.98rem, 1.24vw, 1.1rem);
  line-height: 1.65;
  color: var(--slide-muted);
}

.slide :deep(ul) {
  padding-left: 1.15rem;
}

.slide :deep(li) {
  margin: 0.42rem 0;
  font-size: clamp(0.92rem, 1.08vw, 1rem);
  line-height: 1.45;
  color: var(--slide-muted);
}

.slide :deep(a) {
  color: inherit;
}

.slide :deep(.badge) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.42rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: var(--slide-fg);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.slide--default :deep(.badge),
.slide--diagram :deep(.badge) {
  background: rgba(37, 99, 235, 0.1);
  border-color: rgba(37, 99, 235, 0.14);
  color: #1d4ed8;
}

.slide :deep(.eyebrow) {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--slide-accent);
}

.slide :deep(.accent) {
  background: linear-gradient(120deg, #60a5fa 0%, #5eead4 95%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.slide :deep(.lead) {
  max-width: 52rem;
  font-size: clamp(1.1rem, 1.85vw, 1.4rem);
  line-height: 1.55;
  color: var(--slide-lead);
}

.slide :deep(.subtitle) {
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--slide-subtle);
}

.slide :deep(.metrics-grid),
.slide :deep(.story-grid),
.slide :deep(.card-grid),
.slide :deep(.signal-grid),
.slide :deep(.compare-grid),
.slide :deep(.panel-grid),
.slide :deep(.stack-grid) {
  display: grid;
  gap: 1rem;
}

.slide :deep(.metrics-grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: 100%;
  margin-top: 0.4rem;
}

.slide :deep(.metric),
.slide :deep(.story-card),
.slide :deep(.card),
.slide :deep(.signal-card),
.slide :deep(.compare-card),
.slide :deep(.panel),
.slide :deep(.stack-card) {
  padding: 1.05rem 1.15rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 18px 40px -30px rgba(15, 23, 42, 0.24);
}

.slide--title :deep(.metric),
.slide--cta :deep(.metric),
.slide--title :deep(.card),
.slide--cta :deep(.card) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.slide :deep(.metric strong) {
  display: block;
  font-size: clamp(1.45rem, 3vw, 2rem);
  line-height: 1;
  color: var(--slide-fg);
}

.slide :deep(.metric span) {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--slide-subtle);
}

.slide :deep(.story-grid),
.slide :deep(.card-grid),
.slide :deep(.signal-grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.slide :deep(.story-card h3),
.slide :deep(.card h3),
.slide :deep(.signal-card h3),
.slide :deep(.panel h3),
.slide :deep(.stack-card strong) {
  margin-bottom: 0.45rem;
}

.slide :deep(.card-icon) {
  font-size: 1.75rem;
  margin-bottom: 0.55rem;
}

.slide :deep(.callout) {
  padding: 1rem 1.15rem;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(20, 184, 166, 0.08) 100%);
  border: 1px solid rgba(37, 99, 235, 0.12);
  font-weight: 600;
  color: #0f172a;
}

.slide :deep(.signal-card) {
  background: rgba(248, 250, 252, 0.92);
}

.slide :deep(.compare-grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
}

.slide :deep(.compare-card) {
  text-align: left;
}

.slide :deep(.compare-label) {
  display: inline-flex;
  margin-bottom: 0.7rem;
  padding: 0.28rem 0.72rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.slide :deep(.compare-card--bad) {
  background: linear-gradient(180deg, #fff7f7 0%, #fff1f2 100%);
  border-color: rgba(239, 68, 68, 0.16);
}

.slide :deep(.compare-card--bad .compare-label) {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.slide :deep(.compare-card--good) {
  background: linear-gradient(180deg, #f3fff7 0%, #ecfdf5 100%);
  border-color: rgba(34, 197, 94, 0.16);
}

.slide :deep(.compare-card--good .compare-label) {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.slide :deep(.compare-card--impact) {
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  border-color: rgba(37, 99, 235, 0.16);
}

.slide :deep(.compare-card--impact .compare-label) {
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.slide :deep(.tight-list) {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.slide :deep(.panel-grid) {
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
}

.slide :deep(.panel--quote) {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(20, 184, 166, 0.1) 100%);
}

.slide :deep(.query-quote) {
  font-size: clamp(1.25rem, 2vw, 1.7rem);
  line-height: 1.25;
  font-weight: 750;
  color: var(--slide-fg);
}

.slide :deep(.mono-block) {
  padding: 1rem 1.15rem;
  border-radius: 24px;
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 20px 44px -32px rgba(2, 6, 23, 0.84);
  color: #e2e8f0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.86rem;
  line-height: 1.75;
}

.slide :deep(.mono-label) {
  display: inline-block;
  margin-bottom: 0.45rem;
  color: #93c5fd;
  font-weight: 700;
}

.slide :deep(.stack-grid) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.slide :deep(.stack-card) {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.slide :deep(.stack-card span) {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--slide-accent);
}

.slide :deep(.stack-card p) {
  font-size: 0.94rem;
  line-height: 1.5;
}

.slide :deep(.cta-buttons) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.slide :deep(.btn-primary),
.slide :deep(.btn-secondary) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 12rem;
  padding: 0.9rem 1.6rem;
  border-radius: 999px;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 700;
  transition:
    transform 220ms ease,
    background 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease;
}

.slide :deep(.btn-primary) {
  background: linear-gradient(90deg, #2563eb 0%, #14b8a6 100%);
  color: #eff6ff;
  box-shadow: 0 22px 40px -24px rgba(37, 99, 235, 0.72);
}

.slide :deep(.btn-primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 26px 46px -26px rgba(37, 99, 235, 0.82);
}

.slide :deep(.btn-secondary) {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.7);
  color: var(--slide-fg);
}

.slide :deep(.btn-secondary:hover) {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.9);
}

.slide--title :deep(.btn-secondary),
.slide--cta :deep(.btn-secondary) {
  border-color: rgba(226, 232, 240, 0.24);
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
}

.slide :deep(.demo-link) {
  color: #93c5fd;
  font-weight: 700;
}

.slide :deep(.mermaid-caption) {
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--slide-subtle);
}

.slide :deep(.mermaid),
.slide :deep([class*='language-mermaid']) {
  margin: 0;
}

.slide :deep(svg[id^='mermaid']),
.slide :deep(svg[id*='mermaid']) {
  max-height: 42vh;
}

@media (max-width: 1024px) {
  .slide :deep(.metrics-grid),
  .slide :deep(.compare-grid),
  .slide :deep(.panel-grid),
  .slide :deep(.story-grid),
  .slide :deep(.card-grid),
  .slide :deep(.signal-grid),
  .slide :deep(.stack-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .slide {
    padding: 1.5rem 1rem 5rem;
  }

  .slide-content {
    padding: 1.35rem;
    border-radius: 28px;
  }

  .slide :deep(.metrics-grid),
  .slide :deep(.compare-grid),
  .slide :deep(.panel-grid),
  .slide :deep(.story-grid),
  .slide :deep(.card-grid),
  .slide :deep(.signal-grid),
  .slide :deep(.stack-grid) {
    grid-template-columns: 1fr;
  }

  .slide :deep(.cta-buttons) {
    flex-direction: column;
    width: 100%;
  }

  .slide :deep(.btn-primary),
  .slide :deep(.btn-secondary) {
    width: 100%;
  }
}
</style>
