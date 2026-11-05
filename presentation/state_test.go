package presentation

import (
	"math"
	"sync"
	"testing"
)

func TestEmptyAndInvalid(t *testing.T) {
	var s State
	if got := s.MoveCue(1); got != (Snapshot{}) {
		t.Fatal(got)
	}
	if got := s.Take(); got != (Snapshot{}) {
		t.Fatal(got)
	}
	if _, ok := s.Load("bad", 0); ok {
		t.Fatal("accepted empty document")
	}
	if _, ok := s.Load("", 1); ok {
		t.Fatal("accepted empty name")
	}
}
func TestCueTakeAndBounds(t *testing.T) {
	var s State
	got, ok := s.Load("slides.pdf", 4)
	if !ok || got.Live != 1 || got.Cue != 2 {
		t.Fatal(got)
	}
	got = s.SetCue(4)
	if got.Live != 1 || got.Cue != 4 {
		t.Fatal(got)
	}
	got = s.Take()
	if got.Live != 4 || got.Cue != 4 {
		t.Fatal(got)
	}
	got = s.MoveCue(-100)
	if got.Live != 4 || got.Cue != 1 {
		t.Fatal(got)
	}
	got = s.Take()
	if got.Live != 1 || got.Cue != 2 {
		t.Fatal(got)
	}
	got = s.MoveCue(math.MaxInt)
	if got.Cue != 4 {
		t.Fatal(got)
	}
	got = s.MoveCue(math.MinInt)
	if got.Cue != 1 {
		t.Fatal(got)
	}
	old := got.Generation
	got = s.Clear()
	if got.Generation != old+1 || got.Live != 0 || got.PageCount != 0 {
		t.Fatal(got)
	}
}
func TestConcurrentAccess(t *testing.T) {
	var s State
	s.Load("slides.pdf", 4)
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for j := 0; j < 1000; j++ {
				switch i % 4 {
				case 0:
					s.MoveCue(1)
				case 1:
					s.MoveCue(-1)
				case 2:
					s.Take()
				default:
					v := s.Snapshot()
					if v.Live < 1 || v.Live > 4 || v.Cue < 1 || v.Cue > 4 {
						t.Errorf("invalid snapshot: %+v", v)
						return
					}
				}
			}
		}(i)
	}
	wg.Wait()
}
