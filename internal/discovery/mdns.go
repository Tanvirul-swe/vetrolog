package discovery

import (
	"fmt"
	"log"
	"net"
	"os"

	"github.com/grandcat/zeroconf"

	"vetrolog/internal/version"
)

// MDNSService advertises the VetroLog WebSocket server on the local Wi-Fi network
type MDNSService struct {
	server *zeroconf.Server
}

// NewMDNSService creates and registers the Zeroconf Bonjour advertisement
func NewMDNSService(port int) *MDNSService {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "vetrolog-host"
	}

	txt := []string{fmt.Sprintf("version=%s", version.CurrentVersion), "app=vetrolog"}

	// Register _vetrolog._tcp.local.
	server, err := zeroconf.Register(
		"VetroLog Desktop",
		"_vetrolog._tcp",
		"local.",
		port,
		txt,
		nil,
	)
	if err != nil {
		log.Printf("[VetroLog Discovery] Failed to register mDNS service: %v", err)
		return &MDNSService{}
	}

	log.Printf("[VetroLog Discovery] Broadcasting mDNS service '_vetrolog._tcp' on port %d (%s.local)", port, hostname)
	return &MDNSService{server: server}
}

// Stop shuts down the mDNS broadcaster
func (s *MDNSService) Stop() {
	if s.server != nil {
		s.server.Shutdown()
		log.Printf("[VetroLog Discovery] mDNS service stopped.")
	}
}

// GetLocalIPv4Addresses returns active non-loopback LAN IPv4 addresses
func GetLocalIPv4Addresses() []string {
	var ips []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return ips
	}

	for _, iface := range interfaces {
		// Skip down and loopback interfaces
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}

			if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
				ips = append(ips, ip.String())
			}
		}
	}

	return ips
}
