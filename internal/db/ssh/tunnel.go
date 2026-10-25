package ssh

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"vetrolog/internal/db/types"
)

// Tunnel manages an active SSH port forwarding channel
type Tunnel struct {
	mu          sync.Mutex
	config      *types.SSHTunnelConfig
	sshClient   *ssh.Client
	listener    net.Listener
	localPort   int
	remoteHost  string
	remotePort  int
	stopChan    chan struct{}
	closed      bool
}

// StartTunnel establishes an SSH connection and binds a local listener
func StartTunnel(ctx context.Context, sshCfg *types.SSHTunnelConfig, targetHost string, targetPort int) (*Tunnel, error) {
	if sshCfg == nil || !sshCfg.Enabled {
		return nil, fmt.Errorf("ssh tunnel is disabled")
	}

	authMethods := []ssh.AuthMethod{}

	if strings.ToLower(sshCfg.AuthMethod) == "password" {
		authMethods = append(authMethods, ssh.Password(sshCfg.Password))
	} else {
		// Private Key authentication
		keyBytes := []byte(sshCfg.PrivateKey)
		// Check if it's a file path
		if _, err := os.Stat(sshCfg.PrivateKey); err == nil {
			data, err := os.ReadFile(sshCfg.PrivateKey)
			if err == nil {
				keyBytes = data
			}
		}

		var signer ssh.Signer
		var err error
		if sshCfg.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(keyBytes, []byte(sshCfg.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(keyBytes)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to parse ssh private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	clientConfig := &ssh.ClientConfig{
		User:            sshCfg.User,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // Allow flexible bastions
		Timeout:         10 * time.Second,
	}

	bastionAddr := fmt.Sprintf("%s:%d", sshCfg.Host, sshCfg.Port)
	if sshCfg.Port <= 0 {
		bastionAddr = fmt.Sprintf("%s:22", sshCfg.Host)
	}

	// Dial bastion
	sshClient, err := ssh.Dial("tcp", bastionAddr, clientConfig)
	if err != nil {
		return nil, fmt.Errorf("ssh bastion connection failed (%s): %w", bastionAddr, err)
	}

	// Bind a local listener on 127.0.0.1 on an OS-assigned ephemeral port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		_ = sshClient.Close()
		return nil, fmt.Errorf("failed to bind local forwarding port: %w", err)
	}

	localAddr := listener.Addr().(*net.TCPAddr)
	t := &Tunnel{
		config:     sshCfg,
		sshClient:  sshClient,
		listener:   listener,
		localPort:  localAddr.Port,
		remoteHost: targetHost,
		remotePort: targetPort,
		stopChan:   make(chan struct{}),
	}

	go t.forwardLoop()

	return t, nil
}

// LocalPort returns the ephemeral port bound on 127.0.0.1
func (t *Tunnel) LocalPort() int {
	return t.localPort
}

// Close shuts down the listener and SSH client
func (t *Tunnel) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.closed {
		return nil
	}
	t.closed = true
	close(t.stopChan)

	var errListener, errSSH error
	if t.listener != nil {
		errListener = t.listener.Close()
	}
	if t.sshClient != nil {
		errSSH = t.sshClient.Close()
	}

	if errListener != nil {
		return errListener
	}
	return errSSH
}

func (t *Tunnel) forwardLoop() {
	for {
		localConn, err := t.listener.Accept()
		if err != nil {
			select {
			case <-t.stopChan:
				return
			default:
				return
			}
		}

		go t.handleConnection(localConn)
	}
}

func (t *Tunnel) handleConnection(localConn net.Conn) {
	defer localConn.Close()

	remoteAddr := fmt.Sprintf("%s:%d", t.remoteHost, t.remotePort)
	remoteConn, err := t.sshClient.Dial("tcp", remoteAddr)
	if err != nil {
		return
	}
	defer remoteConn.Close()

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		_, _ = io.Copy(remoteConn, localConn)
	}()

	go func() {
		defer wg.Done()
		_, _ = io.Copy(localConn, remoteConn)
	}()

	wg.Wait()
}
