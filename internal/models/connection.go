package models

// DeviceInfo holds details about the connected mobile client
type DeviceInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Platform    string `json:"platform"` // "android", "ios", "flutter", "react-native"
	OSVersion   string `json:"osVersion"`
	AppID       string `json:"appId"`
	ConnectedAt int64  `json:"connectedAt"` // Unix timestamp in milliseconds
}

// ConnectionState represents the real-time status of the mobile connection
type ConnectionState struct {
	IsConnected   bool        `json:"isConnected"`
	Port          int         `json:"port"`
	Host          string      `json:"host"`
	CurrentDevice *DeviceInfo `json:"currentDevice,omitempty"`
}
