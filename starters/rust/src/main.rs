// SPDX-License-Identifier: MIT

use std::fmt;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Task {
    pub id: u64,
    pub title: String,
    pub completed: bool,
}

#[derive(Debug, Eq, PartialEq)]
pub enum TaskError {
    EmptyTitle,
    NotFound(u64),
}

impl fmt::Display for TaskError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyTitle => write!(formatter, "task title cannot be empty"),
            Self::NotFound(id) => write!(formatter, "task {id} was not found"),
        }
    }
}

impl std::error::Error for TaskError {}

#[derive(Default)]
pub struct TaskList {
    tasks: Vec<Task>,
    next_id: u64,
}

impl TaskList {
    pub fn add(&mut self, title: &str) -> Result<u64, TaskError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(TaskError::EmptyTitle);
        }

        self.next_id += 1;
        self.tasks.push(Task {
            id: self.next_id,
            title: title.to_owned(),
            completed: false,
        });
        Ok(self.next_id)
    }

    pub fn complete(&mut self, id: u64) -> Result<(), TaskError> {
        let task = self
            .tasks
            .iter_mut()
            .find(|task| task.id == id)
            .ok_or(TaskError::NotFound(id))?;
        task.completed = true;
        Ok(())
    }

    pub fn list(&self, completed: Option<bool>) -> Vec<&Task> {
        self.tasks
            .iter()
            .filter(|task| completed.is_none_or(|status| task.completed == status))
            .collect()
    }

    pub fn progress(&self) -> (usize, usize) {
        let completed = self.tasks.iter().filter(|task| task.completed).count();
        (completed, self.tasks.len())
    }
}

fn main() {
    let mut tasks = TaskList::default();
    let first = tasks.add("Build a useful feature").expect("valid task");
    tasks.add("Write tests").expect("valid task");
    tasks.complete(first).expect("task exists");

    let (completed, total) = tasks.progress();
    println!("Tasks: {completed}/{total} complete");
    for task in tasks.list(None) {
        let marker = if task.completed { "x" } else { " " };
        println!("[{marker}] {}. {}", task.id, task.title);
    }
}

#[cfg(test)]
mod tests {
    use super::{TaskError, TaskList};

    #[test]
    fn trims_titles_and_tracks_progress() {
        let mut tasks = TaskList::default();
        let id = tasks.add("  Ship feature  ").unwrap();
        tasks.add("Review tests").unwrap();
        tasks.complete(id).unwrap();

        assert_eq!(tasks.list(Some(true))[0].title, "Ship feature");
        assert_eq!(tasks.progress(), (1, 2));
    }

    #[test]
    fn rejects_blank_titles_and_unknown_ids() {
        let mut tasks = TaskList::default();

        assert_eq!(tasks.add("  "), Err(TaskError::EmptyTitle));
        assert_eq!(tasks.complete(42), Err(TaskError::NotFound(42)));
    }
}
