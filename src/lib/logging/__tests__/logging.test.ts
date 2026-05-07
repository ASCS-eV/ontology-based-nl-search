import {
  createComponentLogger,
  generateRequestId,
  REQUEST_ID_HEADER,
  RequestLogger,
  resetLogLevel,
  setLogLevel,
} from '../index'

describe('logging', () => {
  beforeEach(() => {
    setLogLevel('silent')
  })

  afterEach(() => {
    resetLogLevel()
  })

  describe('generateRequestId', () => {
    it('generates unique prefixed IDs', () => {
      const id1 = generateRequestId()
      const id2 = generateRequestId()
      expect(id1).toMatch(/^req_[0-9a-f-]+$/)
      expect(id2).toMatch(/^req_[0-9a-f-]+$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('REQUEST_ID_HEADER', () => {
    it('is a lowercase HTTP header name', () => {
      expect(REQUEST_ID_HEADER).toBe('x-request-id')
    })
  })

  describe('RequestLogger', () => {
    it('tracks timings for stages', async () => {
      const logger = new RequestLogger({ requestId: 'test-req-1' })

      const endA = logger.time('phase-a')
      await new Promise((r) => setTimeout(r, 10))
      endA()

      const endB = logger.time('phase-b')
      await new Promise((r) => setTimeout(r, 5))
      endB()

      const timings = logger.getTimings()
      expect(timings).toHaveLength(2)
      expect(timings[0]!.stage).toBe('phase-a')
      expect(timings[0]!.durationMs).toBeGreaterThanOrEqual(5)
      expect(timings[1]!.stage).toBe('phase-b')
    })

    it('reports total elapsed time', async () => {
      const logger = new RequestLogger({ requestId: 'test-req-2' })
      await new Promise((r) => setTimeout(r, 15))
      expect(logger.getTotalMs()).toBeGreaterThanOrEqual(10)
    })

    it('exposes requestId as readonly property', () => {
      const logger = new RequestLogger({ requestId: 'test-req-3' })
      expect(logger.requestId).toBe('test-req-3')
    })

    it('emits structured JSON when log level allows', () => {
      setLogLevel('info')
      const spy = jest.spyOn(console, 'info').mockImplementation()

      const logger = new RequestLogger({ requestId: 'test-req-4', query: 'test query' })
      logger.info('hello', { extra: 'data' })

      expect(spy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(parsed.level).toBe('info')
      expect(parsed.message).toBe('hello')
      expect(parsed.requestId).toBe('test-req-4')
      expect(parsed.data.query).toBe('test query')
      expect(parsed.data.extra).toBe('data')
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)

      spy.mockRestore()
    })

    it('suppresses logs below configured level', () => {
      setLogLevel('error')
      const infoSpy = jest.spyOn(console, 'info').mockImplementation()
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const logger = new RequestLogger({ requestId: 'test-req-5' })
      logger.debug('nope')
      logger.info('nope')
      logger.warn('nope')
      logger.error('yes', new Error('boom'))

      expect(infoSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledTimes(1)

      infoSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('includes error details in error logs', () => {
      setLogLevel('error')
      const spy = jest.spyOn(console, 'error').mockImplementation()

      const logger = new RequestLogger({ requestId: 'test-req-6' })
      logger.error('failed', new Error('something broke'))

      const parsed = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(parsed.data.errorMessage).toBe('something broke')
      expect(parsed.data.errorStack).toContain('something broke')

      spy.mockRestore()
    })
  })

  describe('createComponentLogger', () => {
    it('creates a logger with component-based requestId', () => {
      const logger = createComponentLogger('warmup')
      expect(logger.requestId).toBe('sys_warmup')
    })
  })
})
