// SPDX-License-Identifier: MIT

package main

import (
	"errors"
	"fmt"
	"log"
	"strings"
)

var (
	ErrEmptyTitle   = errors.New("task title cannot be empty")
	ErrTaskNotFound = errors.New("task was not found")
)

type Task struct {
	ID        int
	Title     string
	Completed bool
}

type TaskList struct {
	tasks  []Task
	nextID int
}

func (list *TaskList) Add(title string) (int, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return 0, ErrEmptyTitle
	}

	list.nextID++
	list.tasks = append(list.tasks, Task{ID: list.nextID, Title: title})
	return list.nextID, nil
}

func (list *TaskList) Complete(id int) error {
	for index := range list.tasks {
		if list.tasks[index].ID == id {
			list.tasks[index].Completed = true
			return nil
		}
	}
	return fmt.Errorf("%w: %d", ErrTaskNotFound, id)
}

func (list *TaskList) List(completed *bool) []Task {
	tasks := make([]Task, 0, len(list.tasks))
	for _, task := range list.tasks {
		if completed == nil || task.Completed == *completed {
			tasks = append(tasks, task)
		}
	}
	return tasks
}

func (list *TaskList) Progress() (completed, total int) {
	for _, task := range list.tasks {
		if task.Completed {
			completed++
		}
	}
	return completed, len(list.tasks)
}

func main() {
	var tasks TaskList
	first, err := tasks.Add("Build a useful feature")
	if err != nil {
		log.Fatal(err)
	}
	if _, err = tasks.Add("Write tests"); err != nil {
		log.Fatal(err)
	}
	if err = tasks.Complete(first); err != nil {
		log.Fatal(err)
	}

	completed, total := tasks.Progress()
	fmt.Printf("Tasks: %d/%d complete\n", completed, total)
	for _, task := range tasks.List(nil) {
		marker := " "
		if task.Completed {
			marker = "x"
		}
		fmt.Printf("[%s] %d. %s\n", marker, task.ID, task.Title)
	}
}
