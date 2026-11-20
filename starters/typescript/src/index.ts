// SPDX-License-Identifier: MIT

export type Task = {
  id: number;
  title: string;
  completed: boolean;
};

export class TaskList {
  private readonly tasks: Task[] = [];
  private nextId = 1;

  add(title: string): Task {
    const normalized = title.trim();
    if (!normalized) throw new TypeError('Task title cannot be empty.');

    const task = { id: this.nextId++, title: normalized, completed: false };
    this.tasks.push(task);
    return { ...task };
  }

  complete(id: number): Task {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) throw new RangeError(`Task ${id} was not found.`);
    task.completed = true;
    return { ...task };
  }

  list(completed?: boolean): Task[] {
    return this.tasks
      .filter((task) => completed === undefined || task.completed === completed)
      .map((task) => ({ ...task }));
  }

  progress(): { completed: number; total: number } {
    return {
      completed: this.tasks.filter((task) => task.completed).length,
      total: this.tasks.length,
    };
  }
}
