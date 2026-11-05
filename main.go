package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"pdfviewer/document"
	"pdfviewer/presentation"
)

//go:embed all:frontend/dist
var assets embed.FS

type Service struct {
	mu       sync.Mutex
	state    presentation.State
	store    document.Store
	pending  uint64
	name     string
	audience *application.WebviewWindow
}
type Candidate struct {
	Generation uint64 `json:"generation"`
	Name       string `json:"name"`
}

func (s *Service) emit(v presentation.Snapshot) presentation.Snapshot {
	application.Get().Event.Emit("presentation", v)
	return v
}
func (s *Service) Snapshot() presentation.Snapshot { return s.state.Snapshot() }
func (s *Service) Open() (*Candidate, error) {
	path, err := application.Get().Dialog.OpenFile().SetTitle("Open PDF").AddFilter("PDF documents", "*.pdf").PromptForSingleSelection()
	if err != nil {
		return nil, err
	}
	if path == "" {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("Could not read PDF: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	v := s.state.Clear()
	s.emit(v)
	s.pending = v.Generation + 1
	s.name = filepath.Base(path)
	s.store.Install(s.pending, data)
	return &Candidate{s.pending, s.name}, nil
}
func (s *Service) Commit(gen uint64, pages int) (presentation.Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if gen != s.pending || gen == 0 {
		return s.state.Snapshot(), fmt.Errorf("Document was replaced")
	}
	if pages < 1 {
		return s.state.Snapshot(), fmt.Errorf("PDF has no pages")
	}
	v, ok := s.state.Load(s.name, pages)
	if !ok || v.Generation != gen {
		return v, fmt.Errorf("Document changed")
	}
	s.pending = 0
	return s.emit(v), nil
}
func (s *Service) Reject(gen uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.pending == gen {
		s.pending = 0
		s.store.Clear()
	}
}
func (s *Service) Cue(gen uint64, page int) presentation.Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state.Snapshot().Generation != gen {
		return s.state.Snapshot()
	}
	return s.emit(s.state.SetCue(page))
}
func (s *Service) Move(gen uint64, delta int) presentation.Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state.Snapshot().Generation != gen {
		return s.state.Snapshot()
	}
	return s.emit(s.state.MoveCue(delta))
}
func (s *Service) Take(gen uint64) presentation.Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state.Snapshot().Generation != gen {
		return s.state.Snapshot()
	}
	return s.emit(s.state.Take())
}
func (s *Service) Audience() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.audience != nil {
		s.audience.Show()
		s.audience.Focus()
		return
	}
	s.createAudience()
}
func (s *Service) createAudience() {
	app := application.Get()
	var screen *application.Screen
	for _, candidate := range app.Screen.GetAll() {
		if !candidate.IsPrimary {
			screen = candidate
			break
		}
	}
	w := app.Window.NewWithOptions(application.WebviewWindowOptions{Name: "audience", Title: "Audience", URL: "/?audience", Width: 1024, Height: 768, Screen: screen, StartState: application.WindowStateFullscreen, BackgroundColour: application.NewRGB(0, 0, 0)})
	s.audience = w
	w.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		s.mu.Lock()
		if s.audience == w {
			s.audience = nil
		}
		s.mu.Unlock()
	})
}
func (s *Service) ToggleFullscreen() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.audience != nil {
		s.audience.ToggleFullscreen()
	}
}
func (s *Service) ExitFullscreen() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.audience != nil && s.audience.IsFullscreen() {
		s.audience.UnFullscreen()
	}
}
func main() {
	s := &Service{}
	static, _ := fs.Sub(assets, "frontend/dist")
	app := application.New(application.Options{Name: "PDF Slide Viewer", Description: "Presenter and audience PDF viewer", Services: []application.Service{application.NewService(s)}, Assets: application.AssetOptions{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/document/") {
			s.store.ServeHTTP(w, r)
			return
		}
		http.FileServer(http.FS(static)).ServeHTTP(w, r)
	})}, Mac: application.MacOptions{ApplicationShouldTerminateAfterLastWindowClosed: true}})
	operator := app.Window.NewWithOptions(application.WebviewWindowOptions{Name: "operator", Title: "PDF Slide Viewer", URL: "/", Width: 1300, Height: 850, MinWidth: 800, MinHeight: 600})
	operator.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) { app.Quit() })
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(_ *application.ApplicationEvent) { s.Audience() })
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
