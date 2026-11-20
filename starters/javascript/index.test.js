// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import test from 'node:test';
import { TaskList } from './index.js';

test('adds, completes, filters, and summarizes tasks', () => {
  const tasks = new TaskList();
  const first = tasks.add('  Ship feature  ');
  tasks.add('Review tests');
  tasks.complete(first.id);

  assert.equal(tasks.list(true)[0].title, 'Ship feature');
  assert.deepEqual(tasks.progress(), { completed: 1, total: 2 });
});

test('rejects blank titles and unknown ids', () => {
  const tasks = new TaskList();

  assert.throws(() => tasks.add('  '), TypeError);
  assert.throws(() => tasks.complete(99), RangeError);
});
