import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, Terminal, Wifi, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConnectionStore } from '@/stores/useConnectionStore';
import * as AppBindings from '../../../../wailsjs/go/app/App';
import logoIcon from '@/assets/images/vetrolog-icon.png';

interface QRPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QRPairingModal({ isOpen, onClose }: QRPairingModalProps) {
  const isConnected = useConnectionStore((s) => s.isConnected);
  const currentDevice = useConnectionStore((s) => s.currentDevice);
  const defaultPort = useConnectionStore((s) => s.port);

  const [availableIPs, setAvailableIPs] = useState<string[]>(['192.168.0.17']);
  const [selectedIP, setSelectedIP] = useState<string>('192.168.0.17');
  const [selectedTab, setSelectedTab] = useState<'flutter' | 'android' | 'ios' | 'react-native'>('flutter');
  const [qrFormat, setQrFormat] = useState<'deeplink' | 'ws' | 'json'>('deeplink');
  const [copiedAdb, setCopiedAdb] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedWsUrl, setCopiedWsUrl] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch real LAN IP addresses from Go backend
  useEffect(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.go may be undefined
        window?.go?.app?.App?.GetLocalIPAddresses
      ) {
        AppBindings.GetLocalIPAddresses().then((ips) => {
          if (ips && ips.length > 0) {
            setAvailableIPs(ips);
            setSelectedIP(ips[0]);
          }
        });
      }
    } catch {
      // Browser preview fallback
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const wsUrl = `ws://${selectedIP}:${defaultPort}/ws`;

  // Payload depends on selected format
  let qrPayload: string;
  if (qrFormat === 'deeplink') {
    qrPayload = `vetrolog://connect?url=${encodeURIComponent(wsUrl)}&host=${selectedIP}&port=${defaultPort}`;
  } else if (qrFormat === 'ws') {
    qrPayload = wsUrl;
  } else {
    qrPayload = JSON.stringify({
      app: 'vetrolog',
      wsUrl,
      host: selectedIP,
      port: defaultPort,
      version: '1.1.0',
    });
  }

  const copyWsUrl = () => {
    navigator.clipboard.writeText(wsUrl);
    setCopiedWsUrl(true);
    setTimeout(() => setCopiedWsUrl(false), 1500);
  };

  const copyAdbCommand = () => {
    navigator.clipboard.writeText('adb reverse tcp:9222 tcp:9222');
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 1500);
  };

  const getCodeSnippet = () => {
    switch (selectedTab) {
      case 'flutter':
        return `// 1. Add to pubspec.yaml:
//   vetrolog_client:
//     path: /path/to/vetrolog/clients/flutter

// 2. In main.dart:
import 'package:vetrolog_client/vetrolog_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Auto-connects via mDNS or fallback:
  VetroLog.init(host: '${selectedIP}', port: ${defaultPort}, appName: 'MyFlutterApp');
  
  runApp(const MyApp());
}`;

      case 'android':
        return `// Native Android (Kotlin)
// In your Application.onCreate():
import dev.vetrolog.client.VetroLog

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        VetroLog.init(
            context = this,
            host = "${selectedIP}",
            port = ${defaultPort},
            appName = "MyAndroidApp"
        )
    }
}`;

      case 'ios':
        return `// Native iOS (Swift)
// In your AppDelegate or App.init():
import VetroLogClient

@main
struct MyApp: App {
    init() {
        VetroLog.shared.start(
            host: "${selectedIP}",
            port: ${defaultPort},
            appName: "MyiOSApp"
        )
    }
}`;

      case 'react-native':
        return `// React Native / Expo
// In your index.js or App.tsx:
import { VetroLog } from 'vetrolog-client';

VetroLog.init({
  host: '${selectedIP}',
  port: ${defaultPort},
  appName: 'MyReactNativeApp',
});`;
    }
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="wails-no-drag fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm select-text animate-in fade-in duration-150"
    >
      <div className="wails-no-drag relative w-full max-w-[800px] max-h-[88vh] rounded-xl border border-border/80 bg-card shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="shrink-0 h-12 border-b border-border/80 px-4 flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="size-6 rounded-md overflow-hidden border border-primary/30 bg-background/80 flex items-center justify-center p-0.5">
              <img src={logoIcon} alt="VetroLog" className="size-full object-cover rounded-sm" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Connect Mobile App</h2>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-primary/30 text-primary">
              All Platforms
            </Badge>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="hover:bg-muted">
            <X className="size-4" />
          </Button>
        </div>

        {/* Device Status Banner */}
        {isConnected && currentDevice ? (
          <div className="shrink-0 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Connected: <strong>{currentDevice.name}</strong> ({currentDevice.platform})
              </span>
            </div>
            <span className="text-[11px] font-mono opacity-80">{currentDevice.appId}</span>
          </div>
        ) : (
          <div className="shrink-0 px-4 py-2 bg-sky-500/10 border-b border-sky-500/20 flex items-center justify-between text-xs text-sky-400">
            <div className="flex items-center gap-2">
              <Radio className="size-3.5 animate-pulse text-sky-400" />
              <span>mDNS Bonjour Broadcaster Active: <strong className="font-mono">_vetrolog._tcp.local</strong> on port {defaultPort}</span>
            </div>
            <span className="text-[11px] font-mono opacity-75">Auto-discovery ready</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-12 gap-5">
          {/* Left Column: QR Code & IP Selection */}
          <div className="col-span-5 flex flex-col items-center bg-muted/20 border border-border/50 rounded-lg p-3 text-center">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-foreground">
              <QrCode className="size-3.5 text-primary" />
              <span>Scan to Pair on Wi-Fi</span>
            </div>

            {/* QR Format Selector */}
            <div className="flex items-center gap-1 p-0.5 bg-background/80 rounded-md border border-border/60 mb-2.5 text-[10px]">
              <button
                type="button"
                onClick={() => setQrFormat('deeplink')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  qrFormat === 'deeplink'
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Camera deep-link format: vetrolog://connect?url=..."
              >
                Deep Link
              </button>
              <button
                type="button"
                onClick={() => setQrFormat('ws')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  qrFormat === 'ws'
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Raw WebSocket URL: ws://..."
              >
                ws:// URL
              </button>
              <button
                type="button"
                onClick={() => setQrFormat('json')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  qrFormat === 'json'
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="JSON object payload"
              >
                JSON
              </button>
            </div>

            {/* QR Code Container with High-Contrast Background */}
            <div className="bg-white p-2.5 rounded-lg shadow-md mb-2 border border-border">
              <QRCodeSVG value={qrPayload} size={145} level="M" />
            </div>

            {/* 1-Click Copy WebSocket URL */}
            <Button
              variant="outline"
              size="sm"
              onClick={copyWsUrl}
              className="w-full h-6 text-[10px] font-mono gap-1.5 mb-3 border-primary/30 text-primary hover:bg-primary/10"
              title="Click to copy connection URL directly"
            >
              {copiedWsUrl ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              <span className="truncate">{copiedWsUrl ? 'Copied URL!' : wsUrl}</span>
            </Button>

            <p className="text-[10px] text-muted-foreground mb-3 leading-tight text-left">
              💡 <strong>Camera scan:</strong> prompts to open deep link.
              <br />
              📱 <strong>In-app scanner:</strong> pass value to <code className="text-primary font-mono text-[9px]">VetroLog.connectFromQr(...)</code>.
            </p>

            {/* IP Selector */}
            <div className="w-full text-left space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Wifi className="size-3" /> Target Wi-Fi IP
              </label>
              <select
                value={selectedIP}
                onChange={(e) => setSelectedIP(e.target.value)}
                className="w-full h-8 text-xs font-mono bg-card border border-border/80 rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {availableIPs.map((ip) => (
                  <option key={ip} value={ip}>
                    {ip}
                  </option>
                ))}
                <option value="localhost">localhost (USB / Simulator)</option>
              </select>
            </div>

            {/* USB ADB Reverse Helper */}
            <div className="w-full mt-3 pt-3 border-t border-border/50 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Terminal className="size-3" /> Android USB
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAdbCommand}
                  className="h-5 text-[10px] gap-1 px-1.5 text-primary"
                >
                  {copiedAdb ? <Check className="size-2.5 text-emerald-400" /> : <Copy className="size-2.5" />}
                  <span>{copiedAdb ? 'Copied!' : 'Copy command'}</span>
                </Button>
              </div>
              <code className="text-[10px] font-mono bg-background/80 p-1.5 rounded block border border-border/60 text-sky-300 truncate">
                adb reverse tcp:9222 tcp:9222
              </code>
            </div>
          </div>

          {/* Right Column: Multi-Platform Code Snippets */}
          <div className="col-span-7 flex flex-col bg-muted/20 border border-border/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Select Platform SDK</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copySnippet}
                className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                {copiedCode ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </Button>
            </div>

            <Tabs
              value={selectedTab}
              onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="h-7 w-full justify-start bg-card/60 mb-2">
                <TabsTrigger value="flutter" className="text-xs h-6 px-2.5">
                  Flutter
                </TabsTrigger>
                <TabsTrigger value="android" className="text-xs h-6 px-2.5">
                  Android (Kotlin)
                </TabsTrigger>
                <TabsTrigger value="ios" className="text-xs h-6 px-2.5">
                  iOS (Swift)
                </TabsTrigger>
                <TabsTrigger value="react-native" className="text-xs h-6 px-2.5">
                  React Native
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto rounded bg-background/90 p-3 border border-border/60 font-mono text-[11px] text-foreground/90">
                <pre className="whitespace-pre-wrap">{getCodeSnippet()}</pre>
              </div>
            </Tabs>

            <div className="mt-3 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Automatic reconnection enabled.</span>
              <span className="text-primary font-mono">{wsUrl}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 h-11 border-t border-border/80 px-4 flex items-center justify-between bg-muted/30 text-xs">
          <span className="text-muted-foreground text-[11px]">
            No server configuration needed. VetroLog listens on 0.0.0.0:9222.
          </span>
          <Button variant="secondary" size="sm" onClick={onClose} className="h-7 text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
