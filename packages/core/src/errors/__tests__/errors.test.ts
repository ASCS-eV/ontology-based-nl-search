import {
  badRequest,
  extractErrorMessage,
  internalError,
  serviceUnavailable,
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
