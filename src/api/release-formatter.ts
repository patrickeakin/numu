import { MusicBrainzRelease, FormattedRelease } from './types';
import { getCoverArtUrl } from './musicbrainz-client';

// Grouping and deduplication logic
const normalizeForGrouping = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")  // Normalize different apostrophes
    .replace(/[""]/g, '"')  // Normalize different quotes
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
};

export const formatMusicBrainzRelease = async (release: MusicBrainzRelease): Promise<FormattedRelease> => {
  const coverArt = await getCoverArtUrl(release.id);
  
  const artistName = release['artist-credit'][0]?.name || 'Unknown Artist';
  const albumName = release.title;
  
  // Create Spotify search URL for this release
  const searchQuery = encodeURIComponent(`${artistName} ${albumName}`);
  const spotifySearchUrl = `https://open.spotify.com/search/${searchQuery}`;
  
  return {
    id: release.id,
    name: release.title,
    artist: artistName,
    artistId: release['artist-credit'][0]?.artist?.id || '',
    image: coverArt,
    releaseDate: release.date,
    type: release['release-group']?.['primary-type']?.toLowerCase() || 'album',
    spotifyUrl: spotifySearchUrl,
    source: 'musicbrainz'
  };
};

export const groupAndDeduplicateReleases = (releases: FormattedRelease[]): FormattedRelease[] => {
  console.log(`🔍 Before deduplication: ${releases.length} releases`);
  
  // Remove duplicates based on release ID
  const uniqueReleases = releases.filter((release, index, array) => 
    array.findIndex(r => r.id === release.id) === index
  );
  console.log(`🔍 After ID deduplication: ${uniqueReleases.length} releases`);
  
  // Group by album name and artist to remove duplicate album releases
  const albumGroups = new Map<string, FormattedRelease>();
  uniqueReleases.forEach(release => {
    const normalizedArtist = normalizeForGrouping(release.artist);
    const normalizedName = normalizeForGrouping(release.name);
    const albumKey = `${normalizedArtist}::${normalizedName}`;
    
    if (!albumGroups.has(albumKey)) {
      albumGroups.set(albumKey, release);
    } else {
      console.log(`🔄 Grouping duplicate: "${release.name}" by ${release.artist} (${release.releaseDate})`);
    }
  });
  
  const groupedReleases = Array.from(albumGroups.values());
  console.log(`🔍 After album grouping: ${groupedReleases.length} releases`);
  
  if (uniqueReleases.length !== groupedReleases.length) {
    console.log(`⚠️ Grouped ${uniqueReleases.length - groupedReleases.length} duplicate albums`);
  }
  
  return groupedReleases;
};