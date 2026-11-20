// SPDX-License-Identifier: MIT

package main

import "testing"

func TestTaskListOperations(t *testing.T) {
	var tasks TaskList
	id, err := tasks.Add("  Ship feature  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := tasks.Complete(id); err != nil {
		t.Fatal(err)
	}
	if got := tasks.List(nil); len(got) != 1 || got[0].Title != "Ship feature" || !got[0].Completed {
		t.Fatalf("List() = %#v", got)
	}
	if completed, total := tasks.Progress(); completed != 1 || total != 1 {
		t.Fatalf("Progress() = (%d, %d), want (1, 1)", completed, total)
	}
}

func TestTaskListRejectsInvalidInput(t *testing.T) {
	var tasks TaskList
	if _, err := tasks.Add("  "); err != ErrEmptyTitle {
		t.Fatalf("Add(blank) error = %v, want %v", err, ErrEmptyTitle)
	}
	if err := tasks.Complete(99); err == nil {
		t.Fatal("Complete(unknown id) should return an error")
	}
}
