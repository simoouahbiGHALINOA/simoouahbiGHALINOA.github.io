# SPDX-License-Identifier: MIT

import unittest

from main import TaskList


class TaskListTests(unittest.TestCase):
    def test_add_complete_filter_and_progress(self) -> None:
        tasks = TaskList()
        task_id = tasks.add("  Ship feature  ")
        tasks.add("Review tests")
        tasks.complete(task_id)

        self.assertEqual(tasks.list(completed=True)[0].title, "Ship feature")
        self.assertEqual(tasks.progress(), (1, 2))

    def test_rejects_blank_title_and_unknown_id(self) -> None:
        tasks = TaskList()

        with self.assertRaises(ValueError):
            tasks.add("  ")
        with self.assertRaises(KeyError):
            tasks.complete(99)


if __name__ == "__main__":
    unittest.main()
