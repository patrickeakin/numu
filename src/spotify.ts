import axios from 'axios';

const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = process.env.REACT_APP_SPOTIFY_REDIRECT_URI || 'http://localhost:3000';
const SCOPES = 'user-follow-read';

export const getAuthUrl = (): string => {
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    show_dialog: 'true'
  });
  
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

export const getAccessTokenFromUrl = (): string | null => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
};

interface CachedArtistsData {
  artists: any[];
  timestamp: number;
  userId: string;
}

interface CachedReleasesData {
  releases: any[];
  timestamp: number;
  userId: string;
  lastProcessedArtistIndex: number;  // Which artist we stopped at
  totalArtists: number;              // Total artists to process
  isComplete: boolean;               // Whether we got through all artists
  artistListHash: string;            // Hash of followed artists list
  lastRefresh: number;              // When we last got fresh data
}

export const getCachedFollowedArtists = (): CachedArtistsData | null => {
  try {
    const cached = localStorage.getItem('spotify_followed_artists');
    if (cached) {
      const data = JSON.parse(cached) as CachedArtistsData;
      // Check if cache is less than 24 hours old
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - data.timestamp < twentyFourHours) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Error reading cached artists:', error);
    return null;
  }
};

export const cacheFollowedArtists = (artists: any[], userId: string) => {
  try {
    const cacheData: CachedArtistsData = {
      artists,
      timestamp: Date.now(),
      userId
    };
    const dataString = JSON.stringify(cacheData);
    
    // Check if localStorage has enough space
    const estimatedSize = new Blob([dataString]).size;
    console.log(`Attempting to cache ${estimatedSize} bytes of artist data`);
    
    localStorage.setItem('spotify_followed_artists', dataString);
    console.log('Successfully cached artists');
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Clearing old cache and retrying...');
      // Clear old cache and try again
      localStorage.removeItem('spotify_followed_artists');
      try {
        const cacheData: CachedArtistsData = {
          artists,
          timestamp: Date.now(),
          userId
        };
        localStorage.setItem('spotify_followed_artists', JSON.stringify(cacheData));
        console.log('Successfully cached artists after clearing old data');
      } catch (retryError) {
        console.error('Failed to cache artists even after clearing old data:', retryError);
      }
    } else {
      console.error('Error caching artists:', error);
    }
  }
};

// Simple hash function for artist list
const hashArtistList = (artists: any[]): string => {
  const sortedIds = artists.map(a => a.id).sort();
  return btoa(sortedIds.join(',')).substring(0, 16);
};

export const getCachedReleases = (currentArtistHash?: string): CachedReleasesData | null => {
  try {
    const cached = localStorage.getItem('spotify_releases_cache');
    if (cached) {
      const data = JSON.parse(cached) as CachedReleasesData;
      
      // Check if artist list has changed
      if (currentArtistHash && data.artistListHash !== currentArtistHash) {
        console.log('Artist list changed, invalidating cache');
        return null;
      }
      
      // Smart expiration based on completion status
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      
      const expirationTime = data.isComplete ? sevenDays : thirtyDays;
      
      if (now - data.timestamp < expirationTime) {
        return data;
      } else {
        console.log(`Cache expired: ${data.isComplete ? 'complete' : 'incomplete'} cache older than ${data.isComplete ? '7' : '30'} days`);
      }
    }
    return null;
  } catch (error) {
    console.error('Error reading cached releases:', error);
    return null;
  }
};

export const cacheReleases = (
  releases: any[], 
  userId: string, 
  lastProcessedArtistIndex: number,
  totalArtists: number,
  isComplete: boolean,
  artistListHash: string
) => {
  try {
    const cacheData: CachedReleasesData = {
      releases,
      timestamp: Date.now(),
      userId,
      lastProcessedArtistIndex,
      totalArtists,
      isComplete,
      artistListHash,
      lastRefresh: Date.now()
    };
    const dataString = JSON.stringify(cacheData);
    
    // Check if localStorage has enough space
    const estimatedSize = new Blob([dataString]).size;
    console.log(`Attempting to cache ${estimatedSize} bytes of release data`);
    
    localStorage.setItem('spotify_releases_cache', dataString);
    console.log(`Successfully cached ${releases.length} releases (${lastProcessedArtistIndex}/${totalArtists} artists, ${isComplete ? 'complete' : 'incomplete'})`);
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded for releases. Clearing old cache and retrying...');
      // Clear old cache and try again
      localStorage.removeItem('spotify_releases_cache');
      try {
        const cacheData: CachedReleasesData = {
          releases,
          timestamp: Date.now(),
          userId,
          lastProcessedArtistIndex,
          totalArtists,
          isComplete,
          artistListHash,
          lastRefresh: Date.now()
        };
        localStorage.setItem('spotify_releases_cache', JSON.stringify(cacheData));
        console.log('Successfully cached releases after clearing old data');
      } catch (retryError) {
        console.error('Failed to cache releases even after clearing old data:', retryError);
      }
    } else {
      console.error('Error caching releases:', error);
    }
  }
};

export const getCurrentUser = async (accessToken: string): Promise<string> => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data.id;
  } catch (error) {
    console.error('Error getting user info:', error);
    return 'unknown';
  }
};

export const getFollowedArtists = async (accessToken: string, forceRefresh: boolean = false): Promise<any[]> => {
  // Get current user ID for cache validation
  const currentUserId = await getCurrentUser(accessToken);
  
  // Try to use cached data first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = getCachedFollowedArtists();
    if (cached && cached.userId === currentUserId) {
      console.log(`Using cached artists: ${cached.artists.length} artists from ${new Date(cached.timestamp).toLocaleString()}`);
      return cached.artists;
    }
  }
  
  console.log('Fetching fresh followed artists from Spotify...');
  const artists: any[] = [];
  let url = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';
  let pageCount = 0;
  
  while (url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      artists.push(...response.data.artists.items);
      url = response.data.artists.next;
      pageCount++;
      
      console.log(`Fetched page ${pageCount}, total artists: ${artists.length}`);
      
      // Very conservative delay between pages - 2 seconds
      if (url) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 + 2000 : 10000;
        console.warn(`Rate limited while fetching artists page ${pageCount}. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Don't increment URL, retry the same page
      } else {
        console.error('Error fetching followed artists:', error);
        break;
      }
    }
  }
  
  // Cache the results
  cacheFollowedArtists(artists, currentUserId);
  console.log(`Cached ${artists.length} followed artists`);
  
  return artists;
};

export const getNewReleases = async (
  accessToken: string, 
  artistIds: string[], 
  excludeClassical: boolean = false,
  onProgress?: (current: number, total: number, newReleases: number) => void
): Promise<any[]> => {
  const callId = Math.random().toString(36).substring(7);
  console.log(`🔥 getNewReleases called with ID: ${callId}`);
  
  // Get current user ID for cache validation
  const currentUserId = await getCurrentUser(accessToken);
  
  // Create hash of current artist list
  const artistListHash = hashArtistList(artistIds.map(id => ({ id })));
  console.log('Artist list hash:', artistListHash);
  
  // Try to use cached releases first
  const cachedReleases = getCachedReleases(artistListHash);
  console.log('Cache check result:', cachedReleases ? 
    `Found cache with ${cachedReleases.releases.length} releases, ${cachedReleases.lastProcessedArtistIndex}/${cachedReleases.totalArtists} artists processed, ${cachedReleases.isComplete ? 'complete' : 'incomplete'}` : 
    'No cache found'
  );
  console.log('Current userId:', currentUserId);
  
  // If we have a complete cache, use it
  if (cachedReleases && cachedReleases.userId === currentUserId && cachedReleases.isComplete) {
    console.log(`Using complete cached releases: ${cachedReleases.releases.length} releases from ${new Date(cachedReleases.timestamp).toLocaleString()}`);
    if (onProgress) {
      onProgress(artistIds.length, artistIds.length, cachedReleases.releases.length);
    }
    return cachedReleases.releases;
  }
  
  // Determine starting point for processing
  let startIndex = 0;
  let existingReleases: any[] = [];
  
  if (cachedReleases && cachedReleases.userId === currentUserId && !cachedReleases.isComplete) {
    startIndex = cachedReleases.lastProcessedArtistIndex;
    existingReleases = cachedReleases.releases;
    console.log(`Resuming from incomplete cache: starting at artist ${startIndex + 1}/${artistIds.length}, already have ${existingReleases.length} releases`);
  }
  
  console.log('Fetching fresh releases from Spotify...');
  
  // TESTING: Limit to first 3 artists to avoid rate limiting, but respect resume point
  const totalArtists = artistIds.length;
  const remainingArtistIds = artistIds.slice(startIndex, startIndex + 3); // Process 3 at a time from resume point
  console.log(`Processing ${remainingArtistIds.length} artists (${startIndex + 1}-${startIndex + remainingArtistIds.length} of ${totalArtists})`);
  
  const newReleases: any[] = [];
  let currentDelay = 2000; // Start with 2 second delay to avoid 429s
  const minDelay = 2000;
  const maxDelay = 10000;
  let consecutiveErrors = 0;
  let processedCount = 0;
  
  for (let i = 0; i < remainingArtistIds.length; i++) {
    const artistId = remainingArtistIds[i];
    let artistRetries = 0;
    const maxRetries = 2; // Maximum 2 retries per artist
    let artistSuccess = false;
    
    console.log(`Processing artist ${startIndex + i + 1}/${totalArtists}: ${artistId}`);
    
    while (!artistSuccess && artistRetries <= maxRetries) {
      try {
      const url = `https://api.spotify.com/v1/artists/${artistId}/albums`;
      console.log(`Making API call to: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          include_groups: 'album,single',
          market: 'US',
          limit: 20
        }
      });
      
      const filteredAlbums = response.data.items.filter((album: any) => {
        const releaseDate = new Date(album.release_date);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180); // Cache 6 months of data
        return releaseDate >= sixMonthsAgo;
      });
      
      newReleases.push(...filteredAlbums);
      processedCount++;
      
        // Success - reduce delay slightly
        consecutiveErrors = 0;
        currentDelay = Math.max(minDelay, currentDelay * 0.95);
        artistSuccess = true;
        
        // Report progress (combine existing + new releases)
        const totalReleases = existingReleases.length + newReleases.length;
        if (onProgress) {
          onProgress(startIndex + i + 1, totalArtists, totalReleases);
        }
        
      } catch (error: any) {
        if (error.response?.status === 429) {
          artistRetries++;
          consecutiveErrors++;
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 + 1000 : Math.min(currentDelay * 2, maxDelay);
          
          if (artistRetries <= maxRetries) {
            console.warn(`Rate limited (${consecutiveErrors}x). Retry ${artistRetries}/${maxRetries} for artist ${artistId}. Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Increase delay after rate limit
            currentDelay = Math.min(maxDelay, currentDelay * 1.5);
          } else {
            console.error(`Max retries reached for artist ${artistId}. Skipping.`);
            break;
          }
        } else {
          console.error(`Error fetching albums for artist ${artistId}:`, error);
          break;
        }
      }
    }
    
    // Dynamic delay based on current rate limit status (minimum 2000ms)
    await new Promise(resolve => setTimeout(resolve, Math.max(currentDelay, 2000)));
  }
  
  // Combine existing releases with new ones
  const allReleases = [...existingReleases, ...newReleases];
  const finalProcessedIndex = startIndex + processedCount;
  const isComplete = finalProcessedIndex >= totalArtists;
  
  console.log(`Processed ${processedCount} new artists, total releases: ${allReleases.length}`);
  console.log(`Cache status: ${finalProcessedIndex}/${totalArtists} artists (${isComplete ? 'complete' : 'incomplete'})`);
  
  // Filter out classical artists if requested (apply to all releases)
  let finalReleases = allReleases;
  if (excludeClassical) {
    console.log('Applying classical music filter...');
    const filteredReleases = [];
    const artistBatchSize = 50;
    
    for (let i = 0; i < allReleases.length; i += artistBatchSize) {
      const batch = allReleases.slice(i, i + artistBatchSize);
      const artistIds = Array.from(new Set(batch.map(release => release.artists[0].id)));
      
      try {
        const response = await axios.get(`https://api.spotify.com/v1/artists`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            ids: artistIds.join(',')
          }
        });
        
        const artistGenres = new Map();
        response.data.artists.forEach((artist: any) => {
          artistGenres.set(artist.id, artist.genres);
        });
        
        const nonClassicalReleases = batch.filter(release => {
          const genres = artistGenres.get(release.artists[0].id) || [];
          return !genres.some((genre: string) => genre.toLowerCase().includes('classical'));
        });
        
        filteredReleases.push(...nonClassicalReleases);
      } catch (error) {
        console.error('Error fetching artist genres:', error);
        // If genre fetch fails, include all releases from this batch
        filteredReleases.push(...batch);
      }
      
      // Add longer delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    finalReleases = filteredReleases;
  }
  
  // Cache the incremental progress
  console.log('About to cache releases:', finalReleases.length, 'items');
  cacheReleases(finalReleases, currentUserId, finalProcessedIndex, totalArtists, isComplete, artistListHash);
  console.log('Cache save completed');
  
  return finalReleases;
};

export const formatReleaseData = (album: any): any => {
  return {
    id: album.id,
    name: album.name,
    artist: album.artists[0].name,
    artistId: album.artists[0].id,
    image: album.images[0]?.url || '',
    releaseDate: album.release_date,
    type: album.album_type,
    spotifyUrl: album.external_urls.spotify
  };
};

export const addGenreDataToReleases = async (accessToken: string, releases: any[]): Promise<any[]> => {
  const uniqueArtistIds = Array.from(new Set(releases.map(release => release.artistId)));
  const artistGenres = new Map();
  const batchSize = 50;
  
  for (let i = 0; i < uniqueArtistIds.length; i += batchSize) {
    const batch = uniqueArtistIds.slice(i, i + batchSize);
    
    try {
      const response = await axios.get(`https://api.spotify.com/v1/artists`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          ids: batch.join(',')
        }
      });
      
      response.data.artists.forEach((artist: any) => {
        artistGenres.set(artist.id, artist.genres);
      });
    } catch (error) {
      console.error('Error fetching artist genres:', error);
    }
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Add genre information to releases
  return releases.map(release => ({
    ...release,
    artistGenres: artistGenres.get(release.artistId) || []
  }));
};