// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

global.TextDecoder = global.TextDecoder || TextDecoder;
global.TextEncoder = global.TextEncoder || TextEncoder;

jest.mock('./hooks/useApiLoader', () => ({
  __esModule: true,
  default: () => false,
}));

jest.mock('lottie-web', () => ({
  loadAnimation: jest.fn(),
}));

beforeEach(() => {
  require('lottie-web').loadAnimation.mockReturnValue({ destroy: jest.fn() });
});
