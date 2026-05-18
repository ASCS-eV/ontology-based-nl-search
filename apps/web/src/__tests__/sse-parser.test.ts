import { describe, expect, it } from 'vitest'

import { parseSSEBuffer } from '../lib/sse-parser'

describe('parseSSEBuffer', () => {
  it('parses a complete event', () => {
    const buffer = 'event: status\ndata: {"phase":"interpreting"}\n'
    const { events, remainder } = parseSSEBuffer(buffer)

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      event: 'status',
      data: { phase: 'interpreting' },
    })
    expect(remainder).toBe('')
  })

  it('parses multiple events in one buffer', () => {
    const buffer = [
      'event: interpretation',
      'data: {"query":"test"}',
      'event: sparql',
      'data: "SELECT ?s WHERE { ?s ?p ?o }"',
      '',
    ].join('\n')

    const { events, remainder } = parseSSEBuffer(buffer)

    expect(events).toHaveLength(2)
    expect(events[0]?.event).toBe('interpretation')
    expect(events[0]?.data).toEqual({ query: 'test' })
    expect(events[1]?.event).toBe('sparql')
    expect(events[1]?.data).toBe('SELECT ?s WHERE { ?s ?p ?o }')
    expect(remainder).toBe('')
  })

  it('returns incomplete line as remainder', () => {
    const buffer = 'event: status\ndata: {"pha'
    const { events, remainder } = parseSSEBuffer(buffer)

    expect(events).toHaveLength(0)
    expect(remainder).toBe('data: {"pha')
  })

  it('handles empty buffer', () => {
    const { events, remainder } = parseSSEBuffer('')
    expect(events).toHaveLength(0)
    expect(remainder).toBe('')
  })

  it('ignores lines without matching event prefix', () => {
    const buffer = 'comment: ignored\nevent: done\ndata: {}\n'
    const { events } = parseSSEBuffer(buffer)

    expect(events).toHaveLength(1)
    expect(events[0]?.event).toBe('done')
  })

  it('requires event before data to emit', () => {
    const buffer = 'data: {"orphan":true}\n'
    const { events } = parseSSEBuffer(buffer)
    expect(events).toHaveLength(0)
  })

  it('preserves pending event across buffer boundaries', () => {
    // First chunk has event line but no data yet
    const chunk1 = 'event: status\n'
    const result1 = parseSSEBuffer(chunk1)
    expect(result1.events).toHaveLength(0)
    expect(result1.pendingEvent).toBe('status')

    // Second chunk provides the data line, using pendingEvent from first
    const chunk2 = result1.remainder + 'data: {"phase":"done"}\n'
    const result2 = parseSSEBuffer(chunk2, result1.pendingEvent)
    expect(result2.events).toHaveLength(1)
    expect(result2.events[0]).toEqual({
      event: 'status',
      data: { phase: 'done' },
    })
    expect(result2.pendingEvent).toBe('')
  })
})
