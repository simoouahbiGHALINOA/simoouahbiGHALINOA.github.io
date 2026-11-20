// SPDX-License-Identifier: MIT

export class TaskList {
  #tasks = [];
  #nextId = 1;

  add(title) {
    const normalized = title.trim();
    if (!normalized) throw new TypeError('Task title cannot be empty.');

    const task = { id: this.#nextId++, title: normalized, completed: false };
    this.#tasks.push(task);
    return { ...task };
  }

  complete(id) {
    const task = this.#tasks.find((item) => item.id === id);
    if (!task) throw new RangeError(`Task ${id} was not found.`);
    task.completed = true;
    return { ...task };
  }

  list(completed) {
    return this.#tasks
      .filter((task) => completed === undefined || task.completed === completed)
      .map((task) => ({ ...task }));
  }

  progress() {
    return {
      completed: this.#tasks.filter((task) => task.completed).length,
      total: this.#tasks.length,
    };
  }
}
