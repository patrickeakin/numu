# NUMU - Spotify New Releases Tracker

A React application that tracks new releases from your followed Spotify artists using MusicBrainz data, with intelligent caching and comprehensive test automation.

## Features

- **OAuth Authentication**: Secure Spotify login integration
- **Smart Release Tracking**: Fetches releases from followed artists using MusicBrainz API
- **Intelligent Caching**: 30-day cache with resumable import progress
- **Advanced Filtering**: Filter by time periods (today, 7 days, 90 days, 6 months)
- **Flexible Sorting**: Sort by release date or artist name
- **Cover Art Integration**: Displays album artwork from Cover Art Archive with smart fallback handling
- **Smart Release Prioritization**: Automatically selects the best version when multiple formats exist (prioritizes releases with cover art)
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Comprehensive Testing**: 54 Playwright E2E tests with 49 passing (90% success rate)

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **APIs**: Spotify Web API, MusicBrainz API, Cover Art Archive
- **Storage**: localStorage with intelligent quota management
- **Testing**: Playwright with Component Object Model architecture
- **CI/CD**: GitHub Actions with automated testing
- **Styling**: CSS with responsive design

## Prerequisites

- Node.js 16+ and npm
- Spotify Developer Account
- Modern web browser

## Setup

### 1. Clone and Install
```bash
git clone https://github.com/patrickeakin/numu.git
cd numu
npm install
```

### 2. Spotify API Configuration
1. Create a Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add `http://localhost:3000` to your app's redirect URIs
3. Create a `.env` file in the project root:

```env
REACT_APP_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
REACT_APP_SPOTIFY_REDIRECT_URI=http://localhost:3000
```

### 3. Run the Application
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

1. **Login**: Click the NUMU logo to authenticate with Spotify
2. **Import**: Click "Import Followed Artists" to scan for new releases
3. **Filter**: Use duration filters to view releases from specific time periods
4. **Sort**: Toggle between chronological and alphabetical sorting
5. **Listen**: Click any release card to search for it on Spotify

### Caching System

- **Smart Resumption**: Interrupted imports resume from where they left off
- **30-Day Cache**: Avoids redundant API calls for recent data
- **Automatic Refresh**: Expired cache triggers fresh data fetching
- **Quota Management**: Handles localStorage limits gracefully

## Testing

### Running Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all tests
npm run test:e2e

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test auth.spec.ts

# Generate test report
npx playwright show-report
```

### Test Architecture

The test suite uses **Component Object Model** architecture with 54 comprehensive test cases (49 passing, 90% success rate):

#### **Authentication Tests (7 tests)**
- OAuth login/logout flows
- Token expiration handling
- Network error scenarios

#### **Import Flow Tests (8 tests)**
- Fresh data imports
- Cache resumption
- Rate limiting handling
- Data deduplication

#### **UI Interaction Tests (13 tests)**
- Duration filtering
- Sorting functionality
- Responsive design
- Cover art loading with failure detection
- Loading states and transitions
- Mixed image loading scenarios

#### **Error Handling Tests (14 tests)**
- API failures
- Network connectivity issues
- Malformed data handling
- Edge case scenarios

### Test Structure
```
tests/
├── e2e/                    # Test specifications
├── component-objects/      # Page object models
├── mocks/                  # API mocking services
├── helpers/                # Test utilities
├── fixtures/               # Test data
└── playwright.config.ts    # Test configuration
```

## API Integration

### Spotify Web API
- **Endpoint**: `/v1/me/following` - Fetch followed artists
- **Rate Limiting**: 2-second delays between paginated requests
- **Error Handling**: Graceful degradation with user notifications

### MusicBrainz API
- **Search**: Artist lookup with name normalization
- **Releases**: Recent release fetching (180-day window)
- **Rate Limiting**: 1 request per second with backoff
- **User Agent**: Compliant identification header

### Cover Art Archive
- **Images**: Album artwork thumbnails with smart fallback detection
- **Caching**: In-memory image URL caching
- **Error Handling**: Detects both API failures and browser image loading failures
- **Loading States**: Visual feedback during image loading with CSS animations
- **Smart Prioritization**: When multiple releases exist, prioritizes those with cover art

## Development

### Available Scripts

```bash
npm start          # Development server
npm run build      # Production build
npm test           # Jest unit tests (if any)
npm run test:e2e   # Playwright E2E tests
```

### Architecture Overview

```
src/
├── App.tsx                    # Main application component
├── components/
│   └── CoverArt.tsx          # Advanced cover art component with loading states
├── api/                      # Modular API layer
│   ├── unified-api.ts        # Main orchestration
│   ├── spotify-client.ts     # Spotify OAuth & artist fetching
│   ├── musicbrainz-client.ts # MusicBrainz release search
│   ├── cache-manager.ts      # localStorage caching
│   ├── release-formatter.ts  # Smart grouping & deduplication
│   └── types.ts             # Shared TypeScript interfaces
└── App.css                   # Styling with loading animations

Key Features:
- Modular API architecture with focused responsibilities
- Smart release deduplication with cover art prioritization
- Advanced image loading detection with error handlers
- Component-based React architecture with loading states
- Intelligent caching with resumable operations
```

