package main

import "testing"

func TestStaleCommandsAndCommitAreRejected(t *testing.T) {
	s := &Service{}
	first, _ := s.state.Load("first.pdf", 4)
	s.state.Clear()
	second, _ := s.state.Load("second.pdf", 3)
	if got := s.Cue(first.Generation, 3); got != second {
		t.Fatalf("stale cue changed state: %+v", got)
	}
	if got := s.Move(first.Generation, 1); got != second {
		t.Fatalf("stale move changed state: %+v", got)
	}
	if got := s.Take(first.Generation); got != second {
		t.Fatalf("stale take changed state: %+v", got)
	}
	if _, err := s.Commit(first.Generation, 4); err == nil {
		t.Fatal("accepted stale commit")
	}
}
