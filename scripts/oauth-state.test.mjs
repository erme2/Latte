import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const source = readFileSync('src/helpers/oauthState.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const outputDirectory = mkdtempSync(join(tmpdir(), 'burro-oauth-state-'));
const outputFile = join(outputDirectory, 'oauthState.mjs');
writeFileSync(outputFile, compiled);

const {
  assertOAuthStateMatches,
  clearExpectedOAuthState,
  consumeExpectedOAuthState,
  storeExpectedOAuthState,
} = await import(outputFile);

function createStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const storage = createStorage();

assert.throws(() => storeExpectedOAuthState(storage, ''), /Missing WorkOS login state/);

storeExpectedOAuthState(storage, 'expected-state');
assert.equal(consumeExpectedOAuthState(storage), 'expected-state');
assert.equal(consumeExpectedOAuthState(storage), null);

storeExpectedOAuthState(storage, 'clear-me');
clearExpectedOAuthState(storage);
assert.equal(consumeExpectedOAuthState(storage), null);

assert.doesNotThrow(() => assertOAuthStateMatches('expected-state', 'expected-state'));
assert.throws(() => assertOAuthStateMatches(null, 'expected-state'), /Invalid WorkOS login state/);
assert.throws(() => assertOAuthStateMatches('expected-state', null), /Invalid WorkOS login state/);
assert.throws(() => assertOAuthStateMatches('expected-state', 'wrong-state'), /Invalid WorkOS login state/);
