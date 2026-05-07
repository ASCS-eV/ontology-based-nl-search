import {
  badRequest,
  extractErrorMessage,
  internalError,
  serviceUnavailable,
  unprocessable,
} from '../index'

describe('API error utilities', () => {
  it('badRequest returns 400 with error message', async () => {
    const response = badRequest('Invalid input')
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'Invalid input', code: 'BAD_REQUEST' })
  })

  it('badRequest includes details when provided', async () => {
    const response = badRequest('Validation failed', ['field1: required', 'field2: too long'])
    const body = await response.json()
    expect(body.details).toEqual(['field1: required', 'field2: too long'])
  })

  it('unprocessable returns 422', async () => {
    const response = unprocessable('Invalid query')
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.code).toBe('UNPROCESSABLE_ENTITY')
  })

  it('internalError returns 500 with generic message', async () => {
    const response = internalError()
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('An unexpected error occurred')
    expect(body.code).toBe('INTERNAL_ERROR')
  })

  it('serviceUnavailable returns 503', async () => {
    const response = serviceUnavailable('LLM provider is down')
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error).toBe('LLM provider is down')
    expect(body.code).toBe('SERVICE_UNAVAILABLE')
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
