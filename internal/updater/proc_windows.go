//go:build windows

package updater

import (
	"os/exec"
	"syscall"
)

// detachProcess detaches the spawned process from the parent on Windows
func detachProcess(cmd *exec.Cmd) {
	// 0x00000008 = DETACHED_PROCESS, 0x00000200 = CREATE_NEW_PROCESS_GROUP
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x00000008 | 0x00000200,
	}
}
