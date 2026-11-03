// Kept separate from generated bindings so Wails can regenerate them freely.
export interface DesktopSettings {
  closeToTray: boolean
  autostart: boolean
  autoConnect: boolean
  autoConnectServerId: string
  autoConnectError: string
  supported: boolean
  trayAvailable: boolean
  trayError: string
  installedPath: string
  vpnHelperAvailable: boolean
}

interface DesktopAPI {
  DesktopSettings(): Promise<DesktopSettings>
  SetCloseToTray(enabled: boolean): Promise<void>
  SetAutostart(enabled: boolean): Promise<void>
  SetAutoConnect(enabled: boolean, serverId: string): Promise<void>
  InstallDesktop(): Promise<string>
  CreateDesktopShortcut(): Promise<string>
  InstallVPNHelper(): Promise<void>
  RemoveVPNHelper(): Promise<void>
  MinimiseToTray(): Promise<void>
  Quit(): Promise<void>
}

export function desktop(): DesktopAPI {
  return (window as unknown as {go: {main: {App: DesktopAPI}}}).go.main.App
}
