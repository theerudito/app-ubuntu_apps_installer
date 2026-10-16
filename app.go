package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

type InstallResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Output  string `json:"output"`
}

type InstalledApplication struct {
	PackageName string `json:"packageName"`
	Version     string `json:"version"`
	Description string `json:"description"`
}

var packageIdentifierPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9+.-]*(?::[a-z0-9][a-z0-9+.-]*)?$`)

// SelectDebFile opens a native file picker restricted to Debian packages.
func (a *App) SelectDebFile() (string, error) {
	path, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select a Debian package",
		Filters: []wailsRuntime.FileFilter{
			{
				DisplayName: "Debian package (*.deb)",
				Pattern:     "*.deb",
			},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	if err := validateDebPath(path); err != nil {
		return "", err
	}

	return path, nil
}

// InstallDeb reinstalls the selected Debian package using graphical privilege escalation.
func (a *App) InstallDeb(path string) InstallResult {
	if runtime.GOOS != "linux" {
		return InstallResult{
			Success: false,
			Message: "Installation is only supported on Linux/Ubuntu. Build and run this app on Ubuntu to install .deb packages.",
		}
	}

	if err := validateDebPath(path); err != nil {
		return InstallResult{Success: false, Message: err.Error()}
	}

	if _, err := exec.LookPath("pkexec"); err != nil {
		return InstallResult{
			Success: false,
			Message: fmt.Sprintf("pkexec was not found. Install polkit/pkexec or run manually: sudo apt install --reinstall -y %q", path),
		}
	}

	commandContext := a.ctx
	if commandContext == nil {
		commandContext = context.Background()
	}

	cmd := exec.CommandContext(commandContext, "pkexec", "apt", "install", "--reinstall", "-y", path)
	output, err := cmd.CombinedOutput()
	result := InstallResult{Output: string(output)}
	if err != nil {
		result.Message = fmt.Sprintf("Installation failed: %v", err)
		return result
	}

	result.Success = true
	result.Message = "Package installed successfully."
	return result
}

// ListInstalledApplications returns installed packages that are likely user-facing applications.
func (a *App) ListInstalledApplications() ([]InstalledApplication, error) {
	if runtime.GOOS != "linux" {
		return nil, errors.New("listing installed applications is only supported on Linux/Ubuntu")
	}

	output, err := exec.Command("dpkg-query", "-W", "-f=${Package}\t${Status}\t${Version}\t${Essential}\t${Priority}\t${Section}\t${Description}\n").Output()
	if err != nil {
		return nil, fmt.Errorf("could not list installed packages: %w", err)
	}

	applications := make([]InstalledApplication, 0)
	for _, line := range strings.Split(string(output), "\n") {
		fields := strings.SplitN(line, "\t", 7)
		if len(fields) != 7 || fields[1] != "install ok installed" || strings.EqualFold(fields[3], "yes") {
			continue
		}
		priority := strings.ToLower(fields[4])
		section := strings.ToLower(fields[5])
		if priority != "optional" && priority != "extra" {
			continue
		}
		if isSystemPackageSection(section) {
			continue
		}
		description := strings.TrimSpace(strings.SplitN(fields[6], "\n", 2)[0])
		applications = append(applications, InstalledApplication{
			PackageName: fields[0],
			Version:     fields[2],
			Description: description,
		})
	}

	sort.Slice(applications, func(i, j int) bool { return applications[i].PackageName < applications[j].PackageName })
	return applications, nil
}

// UninstallPackage removes a verified installed package using graphical privilege escalation.
func (a *App) UninstallPackage(packageName string) InstallResult {
	if runtime.GOOS != "linux" {
		return InstallResult{Message: "Uninstallation is only supported on Linux/Ubuntu."}
	}
	if !packageIdentifierPattern.MatchString(packageName) {
		return InstallResult{Message: "invalid package identifier"}
	}
	status, err := exec.Command("dpkg-query", "-W", "-f=${Status}", packageName).Output()
	if err != nil || strings.TrimSpace(string(status)) != "install ok installed" {
		return InstallResult{Message: "package is not installed"}
	}
	if _, err := exec.LookPath("pkexec"); err != nil {
		return InstallResult{Message: "pkexec was not found. Install polkit/pkexec before uninstalling packages."}
	}

	commandContext := a.ctx
	if commandContext == nil {
		commandContext = context.Background()
	}
	output, err := exec.CommandContext(commandContext, "pkexec", "apt", "remove", "-y", packageName).CombinedOutput()
	result := InstallResult{Output: string(output)}
	if err != nil {
		result.Message = fmt.Sprintf("uninstallation failed: %v", err)
		return result
	}
	result.Success = true
	result.Message = "Package uninstalled successfully."
	return result
}

func isSystemPackageSection(section string) bool {
	for _, prefix := range []string{"admin", "base", "devel", "kernel", "libs", "metapackages", "oldlibs", "utils"} {
		if section == prefix || strings.HasPrefix(section, prefix+"/") {
			return true
		}
	}
	return false
}

func validateDebPath(path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("select a .deb file before installing")
	}

	if strings.ToLower(filepath.Ext(path)) != ".deb" {
		return errors.New("selected file must have a .deb extension")
	}

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return errors.New("selected .deb file does not exist")
		}
		return fmt.Errorf("could not access selected file: %w", err)
	}

	if !info.Mode().IsRegular() {
		return errors.New("selected path must be a regular .deb file")
	}

	return nil
}
