# SPDX-License-Identifier: MIT

import sqlite3
import unittest

from run import add_task, complete_task, initialize_database, list_tasks


class TaskDatabaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:")
        initialize_database(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_seed_is_idempotent_and_tasks_can_be_completed(self) -> None:
        initialize_database(self.connection)
        task_id = add_task(self.connection, "Ship feature")
        complete_task(self.connection, task_id)

        self.assertEqual(len(list_tasks(self.connection)), 3)
        self.assertEqual(list_tasks(self.connection, completed=True)[-1][1], "Ship feature")

    def test_rejects_blank_title_and_unknown_task(self) -> None:
        with self.assertRaises(ValueError):
            add_task(self.connection, "  ")
        with self.assertRaises(KeyError):
            complete_task(self.connection, 99)


if __name__ == "__main__":
    unittest.main()
