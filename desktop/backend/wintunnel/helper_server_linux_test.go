//go:build linux

package wintunnel

import (
	"net/netip"
	"reflect"
	"testing"
)

func TestSplitDefaultRoutes(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"0.0.0.0/0", []string{"0.0.0.0/1", "128.0.0.0/1"}},
		{"::/0", []string{"::/1", "8000::/1"}},
		{"10.0.0.0/8", []string{"10.0.0.0/8"}},
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			prefix := netip.MustParsePrefix(tc.in)
			got := splitDefault(prefix)
			strings := make([]string, len(got))
			for i, route := range got {
				strings[i] = route.String()
			}
			if !reflect.DeepEqual(strings, tc.want) {
				t.Fatalf("splitDefault(%s) = %v, want %v", tc.in, strings, tc.want)
			}
		})
	}
}

func TestParsePrefixesRejectsInvalidRoute(t *testing.T) {
	if _, err := parsePrefixes("0.0.0.0/0,garbage"); err == nil {
		t.Fatal("expected invalid route to be rejected before invoking ip")
	}
}
