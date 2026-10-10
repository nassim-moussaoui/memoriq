// The learning engine reads `__DEV__` (React Native global) in a few places.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
