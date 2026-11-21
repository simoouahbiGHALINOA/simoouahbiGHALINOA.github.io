import assert from 'node:assert/strict';
import test from 'node:test';
import { hashSessionToken, isValidOAuthState } from './githubAuth.js';

test('OAuth state must match the browser cookie exactly', () => {
  const state = 'a'.repeat(64);
  assert.equal(isValidOAuthState(state, state), true);
  assert.equal(isValidOAuthState(state, 'b'.repeat(64)), false);
  assert.equal(isValidOAuthState(null, state), false);
  assert.equal(isValidOAuthState(state, null), false);
});

test('session tokens are stored as deterministic SHA-256 hashes, not raw values', () => {
  const token = 'private-session-token';
  const hash = hashSessionToken(token);
  assert.equal(hash, hashSessionToken(token));
  assert.equal(hash.length, 64);
  assert.notEqual(hash, token);
});
