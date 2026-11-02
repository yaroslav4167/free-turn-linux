package assets

import (
	"bytes"
	"image/png"
	"testing"
)

func TestApplicationImages(t *testing.T) {
	for size, data := range map[int][]byte{512: IconPNG, 64: TrayIconPNG} {
		image, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatal(err)
		}
		if image.Bounds().Dx() != size || image.Bounds().Dy() != size {
			t.Fatalf("expected %dx%d icon, got %v", size, size, image.Bounds())
		}
	}
	if !bytes.Contains(IconSVG, []byte("<svg")) {
		t.Fatal("missing SVG application icon")
	}
}
