# SPDX-License-Identifier: MIT

import argparse
import sqlite3
from pathlib import Path

directory = Path(__file__).parent
database_path = directory / "eco.db"


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript((directory / "schema.sql").read_text(encoding="utf-8"))
    connection.executescript((directory / "seed.sql").read_text(encoding="utf-8"))


def add_task(connection: sqlite3.Connection, title: str) -> int:
    normalized = title.strip()
    if not normalized:
        raise ValueError("task title cannot be empty")

    cursor = connection.execute(
        "INSERT INTO tasks (title) VALUES (?)",
        (normalized,),
    )
    return int(cursor.lastrowid)


def complete_task(connection: sqlite3.Connection, task_id: int) -> None:
    cursor = connection.execute(
        "UPDATE tasks SET completed = 1 WHERE id = ?",
        (task_id,),
    )
    if cursor.rowcount == 0:
        raise KeyError(f"task {task_id} was not found")


def list_tasks(
    connection: sqlite3.Connection,
    completed: bool | None = None,
) -> list[tuple[int, str, int]]:
    if completed is None:
        return connection.execute(
            "SELECT id, title, completed FROM tasks ORDER BY id",
        ).fetchall()
    return connection.execute(
        "SELECT id, title, completed FROM tasks WHERE completed = ? ORDER BY id",
        (int(completed),),
    ).fetchall()


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage tasks in a local SQLite database.")
    commands = parser.add_subparsers(dest="command")
    commands.add_parser("list", help="list saved tasks")
    add_command = commands.add_parser("add", help="add a task")
    add_command.add_argument("title", nargs="+")
    complete_command = commands.add_parser("complete", help="complete a task")
    complete_command.add_argument("id", type=int)
    args = parser.parse_args()

    connection = sqlite3.connect(database_path)
    try:
        with connection:
            initialize_database(connection)
            if args.command == "add":
                task_id = add_task(connection, " ".join(args.title))
                print(f"Added task {task_id}.")
            elif args.command == "complete":
                complete_task(connection, args.id)
                print(f"Completed task {args.id}.")
            else:
                for task_id, title, completed in list_tasks(connection):
                    marker = "x" if completed else " "
                    print(f"[{marker}] {task_id}. {title}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
