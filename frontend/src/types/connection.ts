export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'android' | 'ios' | 'flutter' | 'react-native' | string;
  osVersion: string;
  appId: string;
  connectedAt: number;
}

export interface ConnectionState {
  isConnected: boolean;
  port: number;
  host: string;
  currentDevice?: DeviceInfo | null;
}
