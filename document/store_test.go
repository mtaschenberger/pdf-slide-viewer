package document

import (
	"net/http/httptest"
	"testing"
)

func TestOnlyCurrentGenerationIsServed(t *testing.T) {
	var s Store
	data := []byte("%PDF-1.4 sample")
	s.Install(12, data)
	data[0] = 'x'
	for _, tt := range []struct {
		path string
		code int
		body string
	}{
		{"/document/12.pdf", 200, "%PDF-1.4 sample"},
		{"/document/11.pdf", 404, "404 page not found\n"},
		{"/etc/passwd", 404, "404 page not found\n"},
	} {
		w := httptest.NewRecorder()
		s.ServeHTTP(w, httptest.NewRequest("GET", tt.path, nil))
		if w.Code != tt.code || w.Body.String() != tt.body {
			t.Fatalf("%s: %d %q", tt.path, w.Code, w.Body.String())
		}
	}
	s.Install(13, []byte("new"))
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest("GET", "/document/12.pdf", nil))
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
	s.Clear()
	w = httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest("GET", "/document/13.pdf", nil))
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
}
