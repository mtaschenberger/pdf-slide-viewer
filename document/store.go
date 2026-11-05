// Package document serves only the currently installed PDF, keyed by generation.
package document

import (
	"bytes"
	"fmt"
	"net/http"
	"sync"
	"time"
)

var zeroTime time.Time

type Store struct {
	mu         sync.RWMutex
	generation uint64
	data       []byte
}

// Install copies the bytes so callers cannot mutate the served document.
func (s *Store) Install(generation uint64, data []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.generation = generation
	s.data = bytes.Clone(data)
}
func (s *Store) Clear() { s.mu.Lock(); defer s.mu.Unlock(); s.data = nil; s.generation = 0 }
func (s *Store) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	if len(s.data) == 0 || r.URL.Path != fmt.Sprintf("/document/%d.pdf", s.generation) {
		s.mu.RUnlock()
		http.NotFound(w, r)
		return
	}
	data := s.data
	s.mu.RUnlock()
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, "presentation.pdf", zeroTime, bytes.NewReader(data))
}
