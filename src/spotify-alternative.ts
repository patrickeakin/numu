import axios from 'axios';

// MusicBrainz API implementation - experimental alternative to Spotify for release data
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'SpotifyReleasesApp/1.0 (https://github.com/spotify-releases)';

interface MusicBrainzRelease {
  id: string;
  title: string;
  date: string;
  'artist-credit': Array<{
    name: string;
    artist: {
      id: string;
      name: string;
    };
  }>;
  'cover-art-archive': {
    artwork: boolean;
    count: number;
    front: boolean;
    back: boolean;
  };
  'release-group': {
    id: string;
    'primary-type': string;
  };
}

// Search for artist by name in MusicBrainz
export const searchArtistInMusicBrainz = async (artistName: string): Promise<string | null> => {
  try {
    const response = await axios.get(`${MUSICBRAINZ_BASE_URL}/artist`, {
      params: {
        query: `artist:"${artistName}"`,
        fmt: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (response.data.artists && response.data.artists.length > 0) {
      return response.data.artists[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Error searching for artist ${artistName} in MusicBrainz:`, error);
    return null;
  }
};

// Get releases for a specific artist from MusicBrainz
export const getArtistReleasesFromMusicBrainz = async (
  artistId: string, 
  daysBack: number = 180
): Promise<MusicBrainzRelease[]> => {
  try {
    const response = await axios.get(`${MUSICBRAINZ_BASE_URL}/release`, {
      params: {
        artist: artistId,
        fmt: 'json',
        limit: 100,
        inc: 'artist-credits+release-groups+cover-art-archive'
      },
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.data.releases) {
      return [];
    }

    // Filter for recent releases
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    return response.data.releases.filter((release: MusicBrainzRelease) => {
      if (!release.date) return false;
      const releaseDate = new Date(release.date);
      return releaseDate >= cutoffDate;
    });
  } catch (error) {
    console.error(`Error fetching releases for artist ${artistId}:`, error);
    return [];
  }
};

// Get cover art URL from Cover Art Archive (MusicBrainz's cover art service)
export const getCoverArtUrl = async (releaseId: string): Promise<string> => {
  try {
    const response = await axios.get(`https://coverartarchive.org/release/${releaseId}`, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (response.data.images && response.data.images.length > 0) {
      // Get the front cover if available, otherwise first image
      const frontCover = response.data.images.find((img: any) => img.front);
      return frontCover ? frontCover.image : response.data.images[0].image;
    }
    return '';
  } catch (error) {
    // Cover art not available
    return '';
  }
};

interface FormattedRelease {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  image: string;
  releaseDate: string;
  type: string;
  spotifyUrl: string;
  source: string;
}

// Convert MusicBrainz release to our format
export const formatMusicBrainzRelease = async (release: MusicBrainzRelease): Promise<FormattedRelease> => {
  const coverArt = await getCoverArtUrl(release.id);
  
  return {
    id: release.id,
    name: release.title,
    artist: release['artist-credit'][0]?.name || 'Unknown Artist',
    artistId: release['artist-credit'][0]?.artist?.id || '',
    image: coverArt,
    releaseDate: release.date,
    type: release['release-group']?.['primary-type']?.toLowerCase() || 'album',
    spotifyUrl: '', // We don't have Spotify URLs from MusicBrainz
    source: 'musicbrainz'
  };
};

// Main function to get new releases using MusicBrainz
export const getNewReleasesFromMusicBrainz = async (
  spotifyArtists: Array<{ id: string; name: string }>,
  onProgress?: (current: number, total: number, newReleases: number) => void
): Promise<FormattedRelease[]> => {
  const releases: FormattedRelease[] = [];
  let currentDelay = 1100; // Start with 1.1 seconds (conservative for MusicBrainz 1 req/sec limit)
  let totalNewReleases = 0;

  for (let i = 0; i < spotifyArtists.length; i++) {
    const spotifyArtist = spotifyArtists[i];
    
    try {
      // Search for artist in MusicBrainz
      const musicBrainzArtistId = await searchArtistInMusicBrainz(spotifyArtist.name);
      
      if (musicBrainzArtistId) {
        // Wait for rate limit
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        // Get recent releases
        const artistReleases = await getArtistReleasesFromMusicBrainz(musicBrainzArtistId);
        
        // Format releases
        for (const release of artistReleases) {
          try {
            const formattedRelease = await formatMusicBrainzRelease(release);
            releases.push(formattedRelease);
            totalNewReleases++;
          } catch (error) {
            console.error('Error formatting release:', error);
          }
          
          // Small delay for cover art requests
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, spotifyArtists.length, totalNewReleases);
      }
      
    } catch (error: any) {
      if (error.response?.status === 503) {
        // Rate limited - increase delay
        currentDelay = Math.min(currentDelay * 1.5, 5000);
        console.warn(`MusicBrainz rate limited, increasing delay to ${currentDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        i--; // Retry same artist
        continue;
      } else {
        console.error(`Error processing artist ${spotifyArtist.name}:`, error);
      }
    }
  }

  return releases;
};

// Fallback: if MusicBrainz fails, we can still use Spotify
export const shouldUseMusicBrainz = (): boolean => {
  // Add logic here to determine if we should use MusicBrainz
  // For now, we'll make it configurable
  return localStorage.getItem('use_musicbrainz') === 'true';
};