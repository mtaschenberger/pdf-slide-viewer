// Package presentation owns the authoritative, concurrency-safe slide state.
package presentation

import "sync"

// Snapshot is an immutable view of the presentation. Pages are one-based;
// a zero page and zero count mean that no document is ready.
type Snapshot struct {
	Generation uint64 `json:"generation"`
	Revision   uint64 `json:"revision"`
	Name       string `json:"name"`
	PageCount  int    `json:"pageCount"`
	Live       int    `json:"live"`
	Cue        int    `json:"cue"`
}

type State struct {
	mu    sync.RWMutex
	value Snapshot
}

func (s *State) Snapshot() Snapshot { s.mu.RLock(); defer s.mu.RUnlock(); return s.value }

// Load commits a validated document. Each successful load advances the
// generation, including when the same file is opened a second time.
func (s *State) Load(name string, pages int) (Snapshot, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if name == "" || pages < 1 {
		return s.value, false
	}
	s.value.Generation++
	s.value.Revision++
	s.value.Name = name
	s.value.PageCount = pages
	s.value.Live = 1
	s.value.Cue = min(2, pages)
	return s.value, true
}

func (s *State) Clear() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	generation, revision := s.value.Generation+1, s.value.Revision+1
	s.value = Snapshot{Generation: generation, Revision: revision}
	return s.value
}

// SetCue clamps to the valid document range. Without a document it is a no-op.
func (s *State) SetCue(page int) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.value.PageCount == 0 {
		return s.value
	}
	page = max(1, min(page, s.value.PageCount))
	if page != s.value.Cue {
		s.value.Cue = page
		s.value.Revision++
	}
	return s.value
}

func (s *State) MoveCue(delta int) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.value.PageCount == 0 {
		return s.value
	}
	// Avoid integer overflow when callers supply an extreme delta.
	page := s.value.Cue
	if delta > 0 {
		page += min(delta, s.value.PageCount-page)
	} else if delta < 0 {
		if delta <= -(page - 1) {
			page = 1
		} else {
			page += delta
		}
	}
	if page != s.value.Cue {
		s.value.Cue = page
		s.value.Revision++
	}
	return s.value
}

func (s *State) Take() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.value.PageCount == 0 {
		return s.value
	}
	live, cue := s.value.Cue, s.value.Cue
	if cue < s.value.PageCount {
		cue++
	}
	if live != s.value.Live || cue != s.value.Cue {
		s.value.Live, s.value.Cue = live, cue
		s.value.Revision++
	}
	return s.value
}
