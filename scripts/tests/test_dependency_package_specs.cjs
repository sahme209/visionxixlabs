'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePackageSpecs } = require('../validate-dependency-specs.cjs');
test('keeps exact registry packages and permits only the fixed native compiler alias', () => {
  for (const input of ['typescript@5.9.3', '@aws-sdk/client-ecs@3.1166.0', '@typescript/native@npm:typescript@7.0.2', 'typescript@5.9.3 @typescript/native@npm:typescript@7.0.2']) assert.equal(validatePackageSpecs(input), true);
});
test('rejects arbitrary aliases, nonregistry sources, flags and command syntax', () => {
  for (const input of ['', 'typescript@latest', 'typescript@^7.0.2', '--force', 'foo@file:/tmp/x', 'foo@https://example.com/a', '@typescript/native@npm:other@7.0.2', 'foo@npm:typescript@7.0.2', 'typescript@7.0.2;id', 'typescript@7.0.2 $(id)', '@typescript/native@npm:typescript@7.0.2\n--force']) assert.equal(validatePackageSpecs(input), false, input);
});
