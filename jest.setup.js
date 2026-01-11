// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// OpenAI shim for Node.js environment
import 'openai/shims/node'

// Polyfill for Next.js Request/Response APIs
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock environment variables
process.env.USE_MOCK_LLM = 'true'
process.env.OPENAI_MODEL = 'gpt-4-turbo-preview'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      refresh: jest.fn(),
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock Tone.js for tests
jest.mock('tone', () => ({
  start: jest.fn(() => Promise.resolve()),
  Transport: {
    start: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
    seconds: 0,
  },
  Part: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    dispose: jest.fn(),
  })),
  Synth: jest.fn(() => ({
    toDestination: jest.fn(),
    dispose: jest.fn(),
  })),
}))
