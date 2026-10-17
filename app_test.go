package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateDebPath(t *testing.T) {
	tempDir := t.TempDir()
	validPath := filepath.Join(tempDir, "package.deb")
	if err := os.WriteFile(validPath, []byte("package"), 0o600); err != nil {
		t.Fatal(err)
	}

	directoryPath := filepath.Join(tempDir, "directory.deb")
	if err := os.Mkdir(directoryPath, 0o700); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		path string
		want bool
	}{
		{name: "existing deb file", path: validPath, want: true},
		{name: "missing file", path: filepath.Join(tempDir, "missing.deb"), want: false},
		{name: "wrong extension", path: filepath.Join(tempDir, "package.txt"), want: false},
		{name: "directory with deb extension", path: directoryPath, want: false},
		{name: "empty path", path: "", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateDebPath(test.path)
			if (err == nil) != test.want {
				t.Fatalf("validateDebPath(%q) error = %v, want valid = %t", test.path, err, test.want)
			}
		})
	}
}

func TestIsApplicationDesktopEntry(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		{name: "system application entry", path: "/usr/share/applications/example.desktop", want: true},
		{name: "local application entry", path: "/usr/local/share/applications/example.desktop", want: true},
		{name: "different directory", path: "/usr/share/icons/example.desktop", want: false},
		{name: "non desktop file", path: "/usr/share/applications/example.desktop.bak", want: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isApplicationDesktopEntry(test.path); got != test.want {
				t.Fatalf("isApplicationDesktopEntry(%q) = %t, want %t", test.path, got, test.want)
			}
		})
	}
}

func TestFilterInstalledApplications(t *testing.T) {
	packages := []installedPackage{
		{packageName: "editor", status: "install ok installed", version: "1.0", priority: "optional", section: "editors", description: "Text editor"},
		{packageName: "library", status: "install ok installed", priority: "optional", section: "libs"},
		{packageName: "not-installed", status: "deinstall ok config-files", priority: "optional"},
		{packageName: "no-entry", status: "install ok installed", priority: "optional", section: "utils"},
	}
	got := filterInstalledApplications(packages, map[string]struct{}{"editor": {}})
	if len(got) != 1 || got[0].PackageName != "editor" {
		t.Fatalf("filterInstalledApplications() = %#v, want only editor", got)
	}
}
