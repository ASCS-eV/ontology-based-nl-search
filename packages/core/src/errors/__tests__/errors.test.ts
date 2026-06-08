import {
  AgentError,
  AppError,
  badRequest,
  CompileError,
  ConfigError,
  ERROR_CODE,
  extractErrorMessage,
  internalError,
  OntologySourcesError,
  serviceUnavailable,
  StoreUnavailableError,
  unprocessable,
} from '../index.js'

describe('API error utilities', () => {
  it('badRequest returns 400 with error message', () => {
    const result = badRequest('Invalid input')
    expect(result.status).toBe(400)
    expect(result.body).toEqual({ error: 'Invalid input', code: 'BAD_REQUEST' })
  })

  it('badRequest includes details when provided', () => {
    const result = badRequest('Validation failed', ['field1: required', 'field2: too long'])
    expect(result.body.details).toEqual(['field1: required', 'field2: too long'])
  })

  it('unprocessable returns 422', () => {
    const result = unprocessable('Invalid query')
    expect(result.status).toBe(422)
    expect(result.body.code).toBe('UNPROCESSABLE_ENTITY')
  })

  it('internalError returns 500 with generic message', () => {
    const result = internalError()
    expect(result.status).toBe(500)
    expect(result.body.error).toBe('An unexpected error occurred')
    expect(result.body.code).toBe('INTERNAL_ERROR')
  })

  it('serviceUnavailable returns 503', () => {
    const result = serviceUnavailable('LLM provider is down')
    expect(result.status).toBe(503)
    expect(result.body.error).toBe('LLM provider is down')
    expect(result.body.code).toBe('SERVICE_UNAVAILABLE')
  })

  describe('AppError hierarchy', () => {
    /**
     * Regression: status MUST be derived from the class, never the message.
     * If a library reworded the message in CompileError, the HTTP status
     * the API exposes to clients must stay 422. This test reworards and
     * re-instantiates to pin the contract.
     */
    it('derives httpStatus from class, not message content', () => {
      const original = new CompileError('No domains detected')
      const reworded = new CompileError('Some entirely different phrasing')
      expect(original.httpStatus).toBe(422)
      expect(reworded.httpStatus).toBe(422)
      expect(original.httpStatus).toBe(reworded.httpStatus)
    })

    it.each([
      [() => new CompileError('boom'), 422, ERROR_CODE.UNPROCESSABLE_ENTITY],
      [() => new StoreUnavailableError('boom'), 503, ERROR_CODE.SERVICE_UNAVAILABLE],
      [() => new AgentError('boom'), 503, ERROR_CODE.SERVICE_UNAVAILABLE],
      [() => new OntologySourcesError('boom'), 503, ERROR_CODE.SERVICE_UNAVAILABLE],
      [() => new ConfigError('boom'), 503, ERROR_CODE.SERVICE_UNAVAILABLE],
    ] as const)('subclass exposes a stable code and httpStatus', (make, status, code) => {
      const err = make()
      expect(err).toBeInstanceOf(AppError)
      expect(err).toBeInstanceOf(Error)
      expect(err.httpStatus).toBe(status)
      expect(err.code).toBe(code)
      // The constructor.name surfaces in stack traces and log lines, so it
      // must reflect the actual subclass rather than 'Error' or 'AppError'.
      expect(err.name).toBe(err.constructor.name)
    })

    it('preserves the underlying cause when constructed with one', () => {
      const root = new Error('original failure')
      const wrapped = new StoreUnavailableError('endpoint returned 500', { cause: root })
      expect(wrapped.cause).toBe(root)
      expect(wrapped.message).toBe('endpoint returned 500')
    })
  })

  describe('extractErrorMessage', () => {
    it('extracts message from Error instance', () => {
      expect(extractErrorMessage(new Error('test error'))).toBe('test error')
    })

    it('returns string directly', () => {
      expect(extractErrorMessage('string error')).toBe('string error')
    })

    it('returns fallback for unknown types', () => {
      expect(extractErrorMessage(42)).toBe('Unknown error')
      expect(extractErrorMessage(null)).toBe('Unknown error')
      expect(extractErrorMessage(undefined)).toBe('Unknown error')
    })
  })
})
