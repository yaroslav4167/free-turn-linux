//go:build linux

package wintunnel

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"os/exec"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"

	"github.com/samosvalishe/free-turn-proxy/mobile"
)

type helperState struct {
	name   string
	dev4   string
	dev6   string
	gw4    string
	routes [][]string
	dnsSet bool
}

// RunHelper executes only after pkexec starts this binary as root. Its socket
// stays open for the lifetime of a VPN connection; EOF always restores routes
// and per-link DNS, including after an unclean GUI exit.
func RunHelper(socketPath string) error {
	conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: socketPath, Net: "unix"})
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()
	reader := bufio.NewReader(conn)
	var initReq helperRequest
	if readErr := readRequest(reader, &initReq); readErr != nil {
		return readErr
	}
	if initReq.Op != "init" || initReq.Params == nil {
		return errors.New("invalid VPN initialization request")
	}
	state, tunFD, err := prepareHelper(initReq.Params)
	if err != nil {
		_ = json.NewEncoder(conn).Encode(helperReply{Error: err.Error()})
		return err
	}
	defer state.cleanup()
	// The TUN descriptor is sent to the unprivileged process and then
	// closed here. SCM_RIGHTS keeps an independent reference alive in transit.
	message, _ := json.Marshal(helperReply{Dev4: state.dev4, Dev6: state.dev6})
	message = append(message, '\n')
	_, _, err = conn.WriteMsgUnix(message, unix.UnixRights(tunFD), nil)
	_ = unix.Close(tunFD)
	if err != nil {
		return err
	}

	for {
		var req helperRequest
		if err := readRequest(reader, &req); err != nil {
			return nil // parent disconnected; deferred cleanup runs
		}
		var opErr error
		switch req.Op {
		case "routes":
			opErr = state.installRoutes(req.Params, req.Exclusions)
		default:
			opErr = fmt.Errorf("unknown VPN helper operation %q", req.Op)
		}
		reply := helperReply{}
		if opErr != nil {
			reply.Error = opErr.Error()
		}
		if err := json.NewEncoder(conn).Encode(reply); err != nil {
			return err
		}
	}
}

func readRequest(reader *bufio.Reader, req *helperRequest) error {
	line, err := reader.ReadBytes('\n')
	if err != nil {
		return err
	}
	if len(line) > 64*1024 {
		return errors.New("VPN helper request too large")
	}
	return json.Unmarshal(line, req)
}

func prepareHelper(params *mobile.TunnelParams) (*helperState, int, error) {
	if params.MTU < 576 || params.MTU > 9000 {
		return nil, -1, fmt.Errorf("invalid tunnel MTU %d", params.MTU)
	}
	dev4, gw4, err := physicalRoute("-4", "1.1.1.1")
	if err != nil {
		return nil, -1, fmt.Errorf("discover physical route: %w", err)
	}
	dev6, _, _ := physicalRoute("-6", "2606:4700:4700::1111")
	fd, err := unix.Open("/dev/net/tun", unix.O_RDWR|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, -1, fmt.Errorf("open /dev/net/tun: %w", err)
	}
	ifr, err := unix.NewIfreq("ftun%d")
	if err != nil {
		_ = unix.Close(fd)
		return nil, -1, err
	}
	ifr.SetUint16(unix.IFF_TUN | unix.IFF_NO_PI)
	if ioctlErr := unix.IoctlIfreq(fd, unix.TUNSETIFF, ifr); ioctlErr != nil {
		_ = unix.Close(fd)
		return nil, -1, fmt.Errorf("create TUN: %w", ioctlErr)
	}
	name := ifr.Name()
	state := &helperState{name: name, dev4: dev4, dev6: dev6, gw4: gw4}
	if linkErr := runIP("link", "set", "dev", name, "mtu", strconv.Itoa(params.MTU), "up"); linkErr != nil {
		_ = unix.Close(fd)
		return nil, -1, linkErr
	}
	addresses, err := parsePrefixes(params.Addresses)
	if err != nil {
		_ = unix.Close(fd)
		return nil, -1, err
	}
	if len(addresses) == 0 {
		_ = unix.Close(fd)
		return nil, -1, errors.New("WireGuard config has no interface address")
	}
	for _, address := range addresses {
		if err := runIP(familyFlag(address), "addr", "add", address.String(), "dev", name); err != nil {
			_ = unix.Close(fd)
			return nil, -1, err
		}
	}
	return state, fd, nil
}

func (s *helperState) installRoutes(params *mobile.TunnelParams, exclusions []string) error {
	if params == nil {
		return errors.New("missing VPN route parameters")
	}
	for _, raw := range exclusions {
		ip, err := netip.ParseAddr(raw)
		if err != nil {
			return fmt.Errorf("invalid exclusion IP: %w", err)
		}
		if !ip.Is4() {
			continue
		}
		prefix := netip.PrefixFrom(ip, 32)
		args := []string{"-4", "route", "add", prefix.String()}
		if s.gw4 != "" {
			args = append(args, "via", s.gw4)
		}
		args = append(args, "dev", s.dev4)
		if err := s.addRoute(args); err != nil {
			return err
		}
	}
	allowed, err := parsePrefixes(params.AllowedIPs)
	if err != nil {
		return err
	}
	if len(allowed) == 0 {
		return errors.New("WireGuard config has no AllowedIPs")
	}
	for _, prefix := range allowed {
		for _, route := range splitDefault(prefix) {
			if routeErr := s.addRoute([]string{familyFlag(route), "route", "add", route.String(), "dev", s.name}); routeErr != nil {
				return routeErr
			}
		}
	}
	dns, err := parseAddrs(params.DNS)
	if err != nil {
		return err
	}
	if len(dns) > 0 {
		args := []string{"dns", s.name}
		for _, addr := range dns {
			args = append(args, addr.String())
		}
		if err := runCommand("resolvectl", args...); err != nil {
			return fmt.Errorf("set per-link DNS (systemd-resolved required): %w", err)
		}
		s.dnsSet = true
		if err := runCommand("resolvectl", "domain", s.name, "~."); err != nil {
			return err
		}
	}
	return nil
}

func (s *helperState) addRoute(args []string) error {
	if err := runIP(args...); err != nil {
		return err
	}
	s.routes = append(s.routes, args)
	return nil
}

func (s *helperState) cleanup() {
	if s.dnsSet {
		_ = runCommand("resolvectl", "revert", s.name)
	}
	for i := len(s.routes) - 1; i >= 0; i-- {
		args := append([]string(nil), s.routes[i]...)
		args[2] = "del"
		_ = runIP(args...)
	}
}

func parsePrefixes(commaList string) ([]netip.Prefix, error) {
	if strings.TrimSpace(commaList) == "" {
		return nil, nil
	}
	parts := strings.Split(commaList, ",")
	out := make([]netip.Prefix, 0, len(parts))
	for _, part := range parts {
		p, err := netip.ParsePrefix(strings.TrimSpace(part))
		if err != nil {
			return nil, err
		}
		out = append(out, p.Masked())
	}
	return out, nil
}

func parseAddrs(commaList string) ([]netip.Addr, error) {
	if strings.TrimSpace(commaList) == "" {
		return nil, nil
	}
	parts := strings.Split(commaList, ",")
	out := make([]netip.Addr, 0, len(parts))
	for _, part := range parts {
		a, err := netip.ParseAddr(strings.TrimSpace(part))
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, nil
}

func splitDefault(prefix netip.Prefix) []netip.Prefix {
	if prefix.Bits() != 0 {
		return []netip.Prefix{prefix}
	}
	if prefix.Addr().Is4() {
		return []netip.Prefix{netip.MustParsePrefix("0.0.0.0/1"), netip.MustParsePrefix("128.0.0.0/1")}
	}
	return []netip.Prefix{netip.MustParsePrefix("::/1"), netip.MustParsePrefix("8000::/1")}
}

func familyFlag(prefix netip.Prefix) string {
	if prefix.Addr().Is4() {
		return "-4"
	}
	return "-6"
}

func physicalRoute(family, target string) (dev, gateway string, err error) {
	out, err := exec.Command("ip", "-j", family, "route", "get", target).Output() //nolint:gosec,noctx
	if err != nil {
		return "", "", err
	}
	var routes []struct {
		Dev     string `json:"dev"`
		Gateway string `json:"gateway"`
	}
	if err := json.Unmarshal(out, &routes); err != nil || len(routes) == 0 || routes[0].Dev == "" {
		return "", "", errors.New("could not determine the physical network interface")
	}
	return routes[0].Dev, routes[0].Gateway, nil
}

func runIP(args ...string) error { return runCommand("ip", args...) }

func runCommand(name string, args ...string) error {
	out, err := exec.Command(name, args...).CombinedOutput() //nolint:gosec,noctx
	if err != nil {
		return fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, bytes.TrimSpace(out))
	}
	return nil
}
