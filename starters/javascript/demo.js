// SPDX-License-Identifier: MIT

import { TaskList } from './index.js';

const tasks = new TaskList();
const first = tasks.add('Build a useful feature');
tasks.add('Write tests');
tasks.complete(first.id);

const progress = tasks.progress();
console.log(`Tasks: ${progress.completed}/${progress.total} complete`);
for (const task of tasks.list()) {
  console.log(`[${task.completed ? 'x' : ' '}] ${task.id}. ${task.title}`);
}
