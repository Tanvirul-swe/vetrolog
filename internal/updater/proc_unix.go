//go:build !windows

package updater

import (
	"os/exec"
	"syscall"
)

// detachProcess detaches the spawned process from the current process group on Unix
func detachProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}
