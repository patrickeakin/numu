import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './App.css';
import { getAuthUrl, getAccessTokenFromUrl, getFollowedArtists, getNewReleases, formatReleaseData, addGenreDataToReleases } from './spotify';
import { getNewReleasesFromMusicBrainz } from './spotify-alternative';

interface Release {
  id: string;
  name: string;
  artist: string;
  image: string;
  releaseDate: string;
  type: 'album' | 'single' | 'ep';
  spotifyUrl: string;
  artistGenres?: string[];
}

type FilterType = 'today' | '7days' | '90days' | '6months';
type SortType = 'artist' | 'releaseDate';

function App() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<FilterType>('7days');
  const [sort, setSort] = useState<SortType>('releaseDate');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [excludeClassical, setExcludeClassical] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, newReleases: 0 });
  const [useAlternativeAPI, setUseAlternativeAPI] = useState(
    localStorage.getItem('use_musicbrainz') === 'true'
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const accessToken = getAccessTokenFromUrl();
    
    if (accessToken) {
      localStorage.setItem('spotify_access_token', accessToken);
      setIsAuthenticated(true);
      
      // Clear the hash from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Don't automatically fetch releases - wait for user to click button
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = () => {
    window.location.href = getAuthUrl();
  };

  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_releases_cache'); // Clear release cache on logout
    setIsAuthenticated(false);
    setReleases([]);
  };

  const handleToggleAPI = (enabled: boolean) => {
    setUseAlternativeAPI(enabled);
    localStorage.setItem('use_musicbrainz', enabled.toString());
    
    // If user is authenticated, refetch with new API
    const token = localStorage.getItem('spotify_access_token');
    if (token && isAuthenticated) {
      fetchReleases(token);
    }
  };

  const handleInitialFetch = () => {
    const token = localStorage.getItem('spotify_access_token');
    console.log('🎵 handleInitialFetch called');
    console.log('Token exists:', !!token);
    console.log('Is authenticated:', isAuthenticated);
    console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'null');
    
    if (token && isAuthenticated) {
      fetchReleases(token);
    } else {
      console.error('Missing token or not authenticated');
    }
  };

  const handleRefreshArtists = () => {
    const token = localStorage.getItem('spotify_access_token');
    if (token && isAuthenticated) {
      // Clear release cache to force fresh fetch
      localStorage.removeItem('spotify_releases_cache');
      // Force refresh of followed artists
      fetchReleasesWithRefresh(token);
    }
  };

  const fetchReleasesWithRefresh = async (accessToken: string) => {
    try {
      setLoading(true);
      
      // Force refresh followed artists (bypass cache)
      const artists = await getFollowedArtists(accessToken, true);
      const artistIds = artists.map(artist => artist.id);
      
      // Choose API based on experimental toggle
      let formattedReleases: any[];
      
      if (useAlternativeAPI) {
        // Use MusicBrainz for release data
        const artistsWithNames = artists.map(artist => ({ id: artist.id, name: artist.name }));
        const newReleases = await getNewReleasesFromMusicBrainz(
          artistsWithNames,
          (current, total, newReleasesCount) => {
            setLoadingProgress({ current, total, newReleases: newReleasesCount });
          }
        );
        formattedReleases = newReleases; // Already formatted
      } else {
        // Use Spotify API (original implementation)
        const newReleases = await getNewReleases(
          accessToken, 
          artistIds, 
          false, // Never filter during fetch
          (current, total, newReleasesCount) => {
            setLoadingProgress({ current, total, newReleases: newReleasesCount });
          }
        );
        formattedReleases = newReleases.map(formatReleaseData);
      }
      
      // Remove duplicates based on release ID
      const uniqueReleases = formattedReleases.filter((release, index, array) => 
        array.findIndex(r => r.id === release.id) === index
      );
      
      // Add genre information to releases for classical filtering (only for Spotify data)
      if (useAlternativeAPI) {
        // MusicBrainz doesn't have genre filtering yet, store releases as-is
        setReleases(uniqueReleases);
      } else {
        // Add genre information for Spotify releases
        const releasesWithGenres = await addGenreDataToReleases(accessToken, uniqueReleases);
        setReleases(releasesWithGenres);
      }
    } catch (error) {
      console.error('Error fetching releases:', error);
      alert('Error fetching releases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReleases = useCallback(async (accessToken: string) => {
    // Cancel any existing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const newAbortController = new AbortController();
    abortControllerRef.current = newAbortController;

    try {
      setLoading(true);
      setLoadingProgress({ current: 0, total: 0, newReleases: 0 });
      
      // Get followed artists
      console.log('📋 About to fetch followed artists...');
      const artists = await getFollowedArtists(accessToken);
      console.log('📋 Followed artists result:', artists.length, 'artists');
      
      if (newAbortController.signal.aborted) return;
      
      const artistIds = artists.map(artist => artist.id);
      console.log('📋 Artist IDs extracted:', artistIds.length, 'IDs');
      
      // Choose API based on experimental toggle
      let formattedReleases: any[];
      
      if (useAlternativeAPI) {
        // Use MusicBrainz for release data
        const artistsWithNames = artists.map(artist => ({ id: artist.id, name: artist.name }));
        const newReleases = await getNewReleasesFromMusicBrainz(
          artistsWithNames,
          (current, total, newReleasesCount) => {
            if (!newAbortController.signal.aborted) {
              setLoadingProgress({ current, total, newReleases: newReleasesCount });
            }
          }
        );
        formattedReleases = newReleases; // Already formatted
      } else {
        // Use Spotify API (original implementation)
        const newReleases = await getNewReleases(
          accessToken, 
          artistIds, 
          false, // Never filter during fetch
          (current, total, newReleasesCount) => {
            if (!newAbortController.signal.aborted) {
              setLoadingProgress({ current, total, newReleases: newReleasesCount });
            }
          }
        );
        formattedReleases = newReleases.map(formatReleaseData);
      }
      
      if (newAbortController.signal.aborted) return;
      
      // Remove duplicates based on release ID
      const uniqueReleases = formattedReleases.filter((release, index, array) => 
        array.findIndex(r => r.id === release.id) === index
      );
      
      // Add genre information to releases for classical filtering (only for Spotify data)
      if (useAlternativeAPI) {
        // MusicBrainz doesn't have genre filtering yet, store releases as-is
        if (!newAbortController.signal.aborted) {
          setReleases(uniqueReleases);
        }
      } else {
        // Add genre information for Spotify releases
        const releasesWithGenres = await addGenreDataToReleases(accessToken, uniqueReleases);
        if (!newAbortController.signal.aborted) {
          setReleases(releasesWithGenres);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch was cancelled');
        return;
      }
      console.error('Error fetching releases:', error);
      alert('Error fetching releases. Please try again.');
    } finally {
      if (!newAbortController.signal.aborted) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [useAlternativeAPI]);

  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token');
    if (token) {
      setIsAuthenticated(true);
      // Don't automatically fetch releases - wait for user to click button
    }
    
    // Cleanup function to cancel ongoing requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleReleaseClick = (spotifyUrl: string) => {
    window.open(spotifyUrl, '_blank');
  };

  const filteredAndSortedReleases = useMemo(() => {
    return releases
      .filter(release => {
        // Filter by date range
        const releaseDate = new Date(release.releaseDate);
        const now = new Date();
        let dateMatch = false;
        
        switch (filter) {
          case 'today':
            dateMatch = releaseDate.toDateString() === now.toDateString();
            break;
          case '7days':
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateMatch = releaseDate >= sevenDaysAgo;
            break;
          case '90days':
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            dateMatch = releaseDate >= ninetyDaysAgo;
            break;
          case '6months':
            const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            dateMatch = releaseDate >= sixMonthsAgo;
            break;
          default:
            dateMatch = true;
        }
        
        // Filter by classical genre if enabled (only works with Spotify data for now)
        if (excludeClassical && release.artistGenres && !useAlternativeAPI) {
          const hasClassical = release.artistGenres.some(genre => 
            genre.toLowerCase().includes('classical')
          );
          return dateMatch && !hasClassical;
        }
        
        return dateMatch;
      })
      .sort((a, b) => {
        if (sort === 'artist') {
          return a.artist.localeCompare(b.artist);
        } else {
          return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        }
      });
  }, [releases, filter, sort, excludeClassical, useAlternativeAPI]);

  if (!isAuthenticated) {
    return (
      <main className="login-container">
        <div className="login">
          <img 
            className="logo" 
            src={`${process.env.PUBLIC_URL}/numu-logo-white.svg`}
            alt="NUMU Logo" 
            onClick={handleLogin}
          />
          <p className="login-instructions">CLICK TO LOGIN</p>
        </div>
      </main>
    );
  }

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="logo-container">
          <img className="sidebar-logo" src="/numu-logo-white.svg" alt="NUMU Logo" />
        </div>
        <div>
          <h3>DURATION</h3>
          <ul>
            <li 
              className={filter === 'today' ? 'active' : ''}
              onClick={() => setFilter('today')}
            >
              <span>TODAY</span>
              {releases.length > 0 && (
                <span className="count">
                  {releases.filter(r => {
                    const date = new Date(r.releaseDate);
                    return date.toDateString() === new Date().toDateString();
                  }).length}
                </span>
              )}
            </li>
            <li 
              className={filter === '7days' ? 'active' : ''}
              onClick={() => setFilter('7days')}
            >
              <span>7 DAYS</span>
              {releases.length > 0 && (
                <span className="count">
                  {releases.filter(r => {
                    const date = new Date(r.releaseDate);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    return date >= weekAgo;
                  }).length}
                </span>
              )}
            </li>
            <li 
              className={filter === '90days' ? 'active' : ''}
              onClick={() => setFilter('90days')}
            >
              <span>90 DAYS</span>
              {releases.length > 0 && (
                <span className="count">
                  {releases.filter(r => {
                    const date = new Date(r.releaseDate);
                    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                    return date >= ninetyDaysAgo;
                  }).length}
                </span>
              )}
            </li>
            <li 
              className={filter === '6months' ? 'active' : ''}
              onClick={() => setFilter('6months')}
            >
              <span>6 MONTHS</span>
              {releases.length > 0 && (
                <span className="count">{releases.length}</span>
              )}
            </li>
          </ul>
        </div>
        <div>
          <h3>ORDER</h3>
          <ul>
            <li 
              className={sort === 'releaseDate' ? 'active' : ''}
              onClick={() => setSort('releaseDate')}
            >
              RECENT
            </li>
            <li 
              className={sort === 'artist' ? 'active' : ''}
              onClick={() => setSort('artist')}
            >
              ARTIST
            </li>
          </ul>
        </div>
        <div>
          <h3>FILTER</h3>
          <div className="toggle-container">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={excludeClassical}
                onChange={(e) => setExcludeClassical(e.target.checked)}
                className="toggle-checkbox"
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">EXCLUDE CLASSICAL</span>
            </label>
          </div>
        </div>
        <div>
          <h3>EXPERIMENTAL</h3>
          <div className="toggle-container">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={useAlternativeAPI}
                onChange={(e) => handleToggleAPI(e.target.checked)}
                className="toggle-checkbox"
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">MUSICBRAINZ API</span>
            </label>
          </div>
        </div>
        <div>
          <ul>
            <li onClick={handleRefreshArtists} style={{ cursor: 'pointer', fontSize: '11px', opacity: 0.8 }}>
              REFRESH ARTISTS
            </li>
            <li onClick={handleLogout} style={{ marginTop: '1rem', cursor: 'pointer' }}>
              LOGOUT
            </li>
          </ul>
        </div>
      </nav>
      
      <div className="content-container">
        <main className="content">
          {loading ? (
            <div className="loading">
              {loadingProgress.total > 0 ? (
                <div className="loading-progress">
                  <div className="loading-text">Scanning artists for new releases...</div>
                  <div className="loading-subtext">
                    {loadingProgress.current} of {loadingProgress.total} artists checked
                  </div>
                  <div className="loading-count">
                    Found {loadingProgress.newReleases} new releases so far
                  </div>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar"
                      style={{
                        width: `${(loadingProgress.current / loadingProgress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="loading-text">Loading new releases...</div>
              )}
            </div>
          ) : releases.length === 0 ? (
            <div className="initial-fetch-container">
              <div className="initial-fetch">
                <p>Click the button below to scan your followed artists for new releases.</p>
                <button className="import-button" onClick={handleInitialFetch}>
                  Import Followed Artists
                </button>
              </div>
            </div>
          ) : filteredAndSortedReleases.length === 0 ? (
            <div className="no-releases">No new releases found for the selected time period.</div>
          ) : (
            filteredAndSortedReleases.map(release => (
              <div 
                key={release.id} 
                className="release-card"
                onClick={() => handleReleaseClick(release.spotifyUrl)}
              >
                <div 
                  className="album-artwork" 
                  style={{ 
                    backgroundImage: `url(${release.image})`,
                    backgroundColor: release.image ? 'transparent' : 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {!release.image && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%', 
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: '12px' 
                    }}>
                      No Cover
                    </div>
                  )}
                </div>
                <div 
                  className={`api-indicator ${useAlternativeAPI ? 'musicbrainz' : 'spotify'}`}
                >
                  {useAlternativeAPI ? 'MB' : 'SP'}
                </div>
                <div className="card-metadata">
                  <div className="card-header">
                    <h3 className="artist-name">{release.artist}</h3>
                    <p className="release-title">{release.name}</p>
                  </div>
                  <div className="card-footer">
                    <span className="release-date">
                      {new Date(release.releaseDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                    <span className={`release-type ${release.type.toLowerCase()}`}>
                      {release.type}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
