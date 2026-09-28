<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'

const props = defineProps<{
  totalSlides: number
  initialSlide?: number
}>()

const emit = defineEmits<{
  complete: []
}>()

const currentSlide = ref(props.initialSlide ?? 0)
const presenterStatus = ref('')

type SpeakerNote = {
  title: string
  timing: string
  script: string
}

const speakerNotes = new Map<number, SpeakerNote>()
let presenterWindow: Window | null = null
let presenterKeydown: ((event: KeyboardEvent) => void) | null = null
let presenterBeforeUnload: (() => void) | null = null

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

function noteFor(index: number): SpeakerNote | undefined {
  return speakerNotes.get(index)
}

function closePresenter() {
  if (presenterWindow && !presenterWindow.closed) {
    if (presenterKeydown) presenterWindow.removeEventListener('keydown', presenterKeydown)
    if (presenterBeforeUnload)
      presenterWindow.removeEventListener('beforeunload', presenterBeforeUnload)
    presenterWindow.close()
  }
  presenterWindow = null
  presenterKeydown = null
  presenterBeforeUnload = null
}

function renderPresenter() {
  if (!presenterWindow || presenterWindow.closed) {
    closePresenter()
    return
  }

  const doc = presenterWindow.document
  const note = noteFor(currentSlide.value)
  const heading = doc.getElementById('presenter-title')
  const timing = doc.getElementById('presenter-timing')
  const script = doc.getElementById('presenter-script')
  const position = doc.getElementById('presenter-position')
  const previous = doc.getElementById('presenter-previous') as HTMLButtonElement | null
  const nextButton = doc.getElementById('presenter-next') as HTMLButtonElement | null

  if (!heading || !timing || !script || !position || !previous || !nextButton) return

  heading.textContent = note?.title ?? `Slide ${currentSlide.value + 1}`
  timing.textContent = note?.timing ?? ''
  script.textContent = note?.script ?? 'No speaker notes for this slide.'
  position.textContent = `Slide ${currentSlide.value + 1} of ${props.totalSlides}`
  previous.disabled = currentSlide.value === 0
  nextButton.disabled = currentSlide.value >= props.totalSlides - 1
  script.scrollTop = 0
  presenterWindow.scrollTo(0, 0)
}

// Keep popup construction and event ownership together so every exit uses the same cleanup path.
function openPresenter() {
  if (presenterWindow && !presenterWindow.closed) {
    presenterStatus.value = ''
    presenterWindow.focus()
    renderPresenter()
    return
  }

  try {
    const opened = window.open(
      '',
      'slide-presenter',
      'popup,width=720,height=640,resizable,scrollbars'
    )
    if (!opened) {
      presenterStatus.value =
        'Presenter window blocked. Allow pop-ups for this site, then press P or select Presenter notes.'
      return
    }
    presenterWindow = opened
    presenterStatus.value = ''

    const doc = opened.document
    doc.documentElement.lang = document.documentElement.lang || 'en'
    doc.head.replaceChildren()
    doc.title = 'Presenter notes'
    const style = doc.createElement('style')
    style.textContent = `
      :root { color-scheme: light; background: #fff; color: #172033; font: 20px/1.6 system-ui, sans-serif; }
      body { box-sizing: border-box; max-width: 60rem; margin: 0 auto; padding: 2rem; background: #fff; color: #172033; }
      header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .5rem 1rem; border-bottom: 1px solid #dbe1ea; padding-bottom: 1rem; }
      h1 { margin: 0; font-size: 1.5rem; }
      #presenter-timing { color: #334155; }
      #presenter-script { margin: 1.5rem 0; white-space: pre-wrap; }
      footer { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; border-top: 1px solid #dbe1ea; padding-top: 1rem; }
      button { padding: .5rem .9rem; font: inherit; cursor: pointer; }
      button:disabled { cursor: default; opacity: .5; }
      #presenter-position { margin-left: auto; color: #334155; }
    `
    doc.head.append(style)

    const body = doc.createElement('body')
    const header = doc.createElement('header')
    const heading = doc.createElement('h1')
    heading.id = 'presenter-title'
    const timing = doc.createElement('div')
    timing.id = 'presenter-timing'
    header.append(heading, timing)
    const script = doc.createElement('main')
    script.id = 'presenter-script'
    const footer = doc.createElement('footer')
    const previous = doc.createElement('button')
    previous.id = 'presenter-previous'
    previous.type = 'button'
    previous.textContent = 'Previous'
    previous.setAttribute('aria-label', 'Previous slide')
    previous.addEventListener('click', prev)
    const nextButton = doc.createElement('button')
    nextButton.id = 'presenter-next'
    nextButton.type = 'button'
    nextButton.textContent = 'Next'
    nextButton.setAttribute('aria-label', 'Next slide')
    nextButton.addEventListener('click', next)
    const position = doc.createElement('output')
    position.id = 'presenter-position'
    footer.append(previous, nextButton, position)
    body.append(header, script, footer)
    doc.body.replaceWith(body)

    presenterKeydown = (event: KeyboardEvent) => {
      // The target belongs to the popup's realm, so use its DOM tag instead of instanceof.
      if (event.key === ' ' && (event.target as HTMLElement | null)?.tagName === 'BUTTON') return
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        prev()
      } else if (event.key === 'Escape') {
        closePresenter()
      }
    }
    presenterBeforeUnload = () => {
      presenterWindow = null
      presenterKeydown = null
      presenterBeforeUnload = null
    }
    opened.addEventListener('keydown', presenterKeydown)
    opened.addEventListener('beforeunload', presenterBeforeUnload, { once: true })
    renderPresenter()
  } catch {
    // A popup may be blocked or its document may be unavailable; the deck remains usable.
    closePresenter()
    presenterStatus.value =
      'Presenter window unavailable. Allow pop-ups for this site, then press P or select Presenter notes.'
  }
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
  openPresenter,
  presenterStatus,
})

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === ' ' && e.target instanceof HTMLButtonElement) return
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
    case 'p':
    case 'P':
      e.preventDefault()
      openPresenter()
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
  for (const element of document.querySelectorAll<HTMLElement>('[data-slide-note]')) {
    const index = Number(element.dataset.slideNote)
    if (!Number.isInteger(index) || index < 0 || index >= props.totalSlides) continue
    const paragraphs = Array.from(element.children)
      .map((child) => child.textContent?.trim() ?? '')
      .filter(Boolean)
    speakerNotes.set(index, {
      title: element.dataset.title ?? `Slide ${index + 1}`,
      timing: element.dataset.timing ?? '',
      script: paragraphs.join('\n\n') || element.textContent?.trim() || '',
    })
  }
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
})

watch(currentSlide, renderPresenter)

onUnmounted(() => {
  closePresenter()
  speakerNotes.clear()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchend', onTouchEnd)
})
</script>

<template>
  <slot />
</template>
