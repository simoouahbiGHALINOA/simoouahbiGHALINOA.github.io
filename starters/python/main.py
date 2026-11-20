# SPDX-License-Identifier: MIT

from dataclasses import dataclass


@dataclass
class Task:
    id: int
    title: str
    completed: bool = False


class TaskList:
    def __init__(self) -> None:
        self._tasks: list[Task] = []
        self._next_id = 1

    def add(self, title: str) -> int:
        normalized = title.strip()
        if not normalized:
            raise ValueError("task title cannot be empty")

        task_id = self._next_id
        self._next_id += 1
        self._tasks.append(Task(task_id, normalized))
        return task_id

    def complete(self, task_id: int) -> None:
        task = self._find(task_id)
        task.completed = True

    def list(self, completed: bool | None = None) -> list[Task]:
        return [
            task for task in self._tasks
            if completed is None or task.completed is completed
        ]

    def progress(self) -> tuple[int, int]:
        completed = sum(task.completed for task in self._tasks)
        return completed, len(self._tasks)

    def _find(self, task_id: int) -> Task:
        for task in self._tasks:
            if task.id == task_id:
                return task
        raise KeyError(f"task {task_id} was not found")


def main() -> None:
    tasks = TaskList()
    first = tasks.add("Build a useful feature")
    tasks.add("Write tests")
    tasks.complete(first)

    completed, total = tasks.progress()
    print(f"Tasks: {completed}/{total} complete")
    for task in tasks.list():
        marker = "x" if task.completed else " "
        print(f"[{marker}] {task.id}. {task.title}")


if __name__ == "__main__":
    main()
