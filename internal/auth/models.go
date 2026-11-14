package auth

// UserProfile represents an authenticated user's profile
type UserProfile struct {
	ID         string `json:"id"`         // Unique Google Subject ID (sub)
	Email      string `json:"email"`      // e.g. dev@gmail.com
	Name       string `json:"name"`       // Display name
	Picture    string `json:"picture"`    // Avatar image URL
	GivenName  string `json:"givenName"`
	FamilyName string `json:"familyName"`
	Provider   string `json:"provider"`   // e.g. "google"
	LoggedInAt string `json:"loggedInAt"`
}

// AuthStatus describes the current authentication state to the client
type AuthStatus struct {
	IsAuthenticated bool         `json:"isAuthenticated"`
	User            *UserProfile `json:"user,omitempty"`
}

// SessionData is persisted locally in ~/.vetrolog/session.json
type SessionData struct {
	User        *UserProfile `json:"user"`
	AccessToken string       `json:"accessToken,omitempty"`
	SavedAt     string       `json:"savedAt"`
}

