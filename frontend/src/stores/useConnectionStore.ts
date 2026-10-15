import { create } from 'zustand';
import { ConnectionState, DeviceInfo } from '../types/connection';

interface ConnectionStoreState extends ConnectionState {
  setConnectionState: (state: ConnectionState) => void;
  setDeviceConnected: (device: DeviceInfo) => void;
  setDeviceDisconnected: () => void;
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  isConnected: false,
  port: 9222,
  host: '0.0.0.0',
  currentDevice: null,

  setConnectionState: (state) => set(() => ({ ...state })),
  setDeviceConnected: (device) => set(() => ({ isConnected: true, currentDevice: device })),
  setDeviceDisconnected: () => set(() => ({ isConnected: false, currentDevice: null })),
}));
