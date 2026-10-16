package main

import (
	"embed"
	"flag"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"vetrolog/internal/app"
	"vetrolog/internal/web"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Parse CLI flags
	webMode := flag.Bool("web", false, "Start VetroLog in Local Web Server mode")
	webPort := flag.Int("port", 8787, "Port for Web Server mode (default: 8787)")
	noBrowser := flag.Bool("no-browser", false, "Do not auto-open the browser in Web Server mode")
	flag.Parse()

	// Check if 'serve' was passed as first argument (e.g. `vetrolog serve`)
	isServeCmd := len(os.Args) > 1 && os.Args[1] == "serve"

	if *webMode || isServeCmd {
		err := web.StartServer(assets, *webPort, !*noBrowser)
		if err != nil {
			println("Web Server Error:", err.Error())
		}
		return
	}

	// Create an instance of the modular application
	appInstance := app.NewApp()

	// Configure Wails application options
	err := wails.Run(&options.App{
		Title:  "VetroLog",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 11, G: 15, B: 25, A: 255}, // Solid deep obsidian
		OnStartup:        appInstance.Startup,
		OnDomReady:       appInstance.DomReady,
		OnBeforeClose:    appInstance.BeforeClose,
		OnShutdown:       appInstance.Shutdown,
		Bind: []interface{}{
			appInstance,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHiddenInset(),
			Appearance:           mac.NSAppearanceNameDarkAqua,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			BackdropType:         windows.Mica,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
