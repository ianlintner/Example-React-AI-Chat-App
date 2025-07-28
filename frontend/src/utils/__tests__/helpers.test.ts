// Simple utility tests to demonstrate testing setup
import { describe, it, expect } from 'vitest'

// Mock utility functions for testing
const formatDate = (date: Date): string => {
  return date.toLocaleDateString()
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

describe('Utility Functions', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-01')
      const formatted = formatDate(date)
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })
  })

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.uk')).toBe(true)
    })

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })

  describe('truncateText', () => {
    it('should truncate text longer than max length', () => {
      const longText = 'This is a very long text that should be truncated'
      const result = truncateText(longText, 20)
      expect(result).toBe('This is a very long ...')
      expect(result.length).toBe(23) // 20 + '...'
    })

    it('should not truncate text shorter than max length', () => {
      const shortText = 'Short text'
      const result = truncateText(shortText, 20)
      expect(result).toBe('Short text')
      expect(result.length).toBe(10)
    })

    it('should handle exact length text', () => {
      const exactText = 'Exactly twenty chars'
      const result = truncateText(exactText, 20)
      expect(result).toBe('Exactly twenty chars')
    })
  })
})
