-- SPDX-License-Identifier: MIT

-- List all tasks.
SELECT id, title, completed
FROM tasks
ORDER BY id;

-- Add a task.
INSERT INTO tasks (title) VALUES (:title);

-- Mark a task as complete.
UPDATE tasks SET completed = 1 WHERE id = :id;

-- Summarize progress.
SELECT
  COUNT(*) AS total,
  SUM(completed) AS completed
FROM tasks;
