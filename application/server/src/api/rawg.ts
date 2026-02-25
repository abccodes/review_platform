import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getPool } from '../connections/database';
import { RowDataPacket } from 'mysql2';
import { CronJob } from 'cron';

// Example usage for testing
// testAddGames()
//   .then(() => {
//     console.log('success');
//   })
//   .catch(error => {
//     console.log('error:', error);
//   });

dotenv.config();

const RAWG_API_KEY = process.env.RAWG_API_KEY;

if (!RAWG_API_KEY) {
  throw new Error('Missing RAWG_API_KEY in .env file');
}

interface GameData {
  id: number;
  name: string;
  description: string | null;
  genres: { name: string }[];
  tags: { name: string }[];
  platforms: { platform: { name: string } }[];
  playtime: number | null;
  developers: { name: string }[];
  publishers: { name: string }[];
  released: string | null;
  rating: number;
  background_image: string | null;
  esrb_rating: { name: string } | null;
  metacritic: number | null;
}

const stripHtmlTags = (str: string | null): string => {
  if (!str) return '';
  return str.replace(/<\/?[^>]+(>|$)/g, '');
};

const getMostPopularGames = async (
  limit: number = 500
): Promise<GameData[]> => {
  try {
    // Use -added to get trending games (most recently added/trending)
    // Or use -relevance for most relevant/popular games
    // -rating alone gives obscure games with few high ratings
    const response = await fetch(
      `https://api.rawg.io/api/games?ordering=-added&key=${RAWG_API_KEY}&page_size=${limit}`
    );
    if (!response.ok) {
      console.error(
        `Failed to fetch most popular games: ${response.statusText}`
      );
      return [];
    }
    const data = await response.json();
    console.log('data:', data);
    return data.results || [];
  } catch (error) {
    console.error('Error fetching most popular games:', error);
    return [];
  }
};

const searchGamesOnRAWG = async (
  query: string,
  limit: number = 20
): Promise<GameData[]> => {
  try {
    // Use -relevance for better search results, then filter for quality
    // Fetch more results than needed so we can filter out low-quality games
    const fetchLimit = Math.min(limit * 5, 100); // Get 5x results to filter from (more aggressive filtering)
    
    console.log(`Searching RAWG API for: "${query}" (fetching ${fetchLimit} results)`);
    
    const response = await fetch(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&key=${RAWG_API_KEY}&page_size=${fetchLimit}&ordering=-relevance,-rating,-metacritic`
    );
    if (!response.ok) {
      console.error(
        `Failed to search games on RAWG: ${response.statusText}`
      );
      return [];
    }
    const data = await response.json();
    let results = data.results || [];
    
    console.log(`RAWG API returned ${results.length} results before filtering`);
    
    // Filter out low-quality/obscure games
    results = filterQualityGames(results, query);
    
    console.log(`After filtering: ${results.length} results`);
    
    // Return top results after filtering
    return results.slice(0, limit);
  } catch (error) {
    console.error('Error searching games on RAWG:', error);
    return [];
  }
};

// Known legitimate publishers for popular franchises
const LEGITIMATE_PUBLISHERS: { [key: string]: string[] } = {
  'fortnite': ['Epic Games', 'Epic Games, Inc.'],
  'call of duty': ['Activision', 'Activision Blizzard', 'Activision Publishing'],
  'minecraft': ['Mojang Studios', 'Microsoft', 'Xbox Game Studios'],
  'grand theft auto': ['Rockstar Games', 'Take-Two Interactive'],
  'fifa': ['EA Sports', 'Electronic Arts'],
  'assassin\'s creed': ['Ubisoft'],
};

// Suspicious title patterns that indicate off-brand/knockoff games
const SUSPICIOUS_PATTERNS = [
  /pack/i,
  /demo/i,
  /looping/i,
  /basics/i,
  /field trip/i,
  /pictures pack/i,
  /images pack/i,
  /test/i,
  /alpha/i,
  /beta/i,
  /prototype/i,
  /fan made/i,
  /fanmade/i,
  /unofficial/i,
  /mod/i,
  /custom/i,
];

// Filter games to keep obvious junk out but allow most real games through
const filterQualityGames = (games: GameData[], searchQuery: string): GameData[] => {
  const searchLower = searchQuery.toLowerCase().trim();

  return games
    .filter(game => {
      // Filter out games with very obviously junky titles (image packs, demos, etc.)
      const hasSuspiciousPattern = SUSPICIOUS_PATTERNS.some(pattern =>
        pattern.test(game.name)
      );
      if (hasSuspiciousPattern) {
        console.log(`Filtered out suspicious game: ${game.name}`);
        return false;
      }

      // Require a real cover image so cards look good
      if (!game.background_image) {
        return false;
      }

      // Very light rating filter – basically let most real games through
      const rating = game.rating || 0;
      if (rating < 1.5) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aTitleLower = a.name.toLowerCase();
      const bTitleLower = b.name.toLowerCase();

      // Prioritize exact title matches first
      const aExactMatch = aTitleLower === searchLower;
      const bExactMatch = bTitleLower === searchLower;
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // Then prioritize titles that start with the search query
      const aStartsWith = aTitleLower.startsWith(searchLower);
      const bStartsWith = bTitleLower.startsWith(searchLower);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Then prioritize by rating (higher is better)
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      if (Math.abs(aRating - bRating) > 0.1) {
        return bRating - aRating;
      }

      // Then by metacritic if available
      const aMetacritic = a.metacritic || 0;
      const bMetacritic = b.metacritic || 0;
      if (aMetacritic !== bMetacritic) {
        return bMetacritic - aMetacritic;
      }

      return 0;
    });
};

// Convert RAWG API game data to database format
const convertRAWGGameToDBFormat = (rawgGame: GameData): any => {
  const description = stripHtmlTags(rawgGame.description) || '';
  const genre = rawgGame.genres?.map((g: any) => g.name).join(', ') || null;
  const tags = rawgGame.tags?.map((tag: any) => tag.name) || [];
  const platforms = rawgGame.platforms?.map((p: any) => p.platform.name) || [];
  const playtime_estimate = rawgGame.playtime || 0;
  const developer =
    rawgGame.developers?.length > 0 ? rawgGame.developers[0].name : 'Unknown';
  const publisher =
    rawgGame.publishers?.length > 0 ? rawgGame.publishers[0].name : 'Unknown';

  // Determine game_mode based on tags or platforms
  const lowerCaseTags = JSON.stringify(tags).toLowerCase();
  const lowerCasePlatforms = JSON.stringify(platforms).toLowerCase();
  let game_mode: string = 'single-player';
  if (lowerCaseTags.includes('multiplayer') || lowerCasePlatforms.includes('multiplayer')) {
    game_mode = 'multiplayer';
  } else if (lowerCaseTags.includes('co-op') || lowerCaseTags.includes('cooperative')) {
    game_mode = 'both';
  }

  // Validate and clamp review_rating
  const rawRating = rawgGame.rating || 0;
  const review_rating = Math.min(Math.max(Math.round(rawRating), 1), 10);

  return {
    title: rawgGame.name,
    description,
    genre,
    tags,
    platforms,
    playtime_estimate,
    developer,
    publisher,
    game_mode,
    release_date: rawgGame.released,
    review_rating,
    cover_image: rawgGame.background_image,
  };
};

const getGameById = async (gameId: number): Promise<GameData | null> => {
  try {
    const response = await fetch(
      `https://api.rawg.io/api/games/${gameId}?key=${RAWG_API_KEY}`
    );
    if (!response.ok) {
      console.error(`Failed to fetch game: ${response.statusText}`);
      return null;
    }
    const data: GameData = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching game:', error);
    return null;
  }
};

const addNewGamesToDatabase = async (games: any[]): Promise<void> => {
  const pool = getPool();
  const gamesToInsert: any[] = [];

  for (const game of games) {
    if (!game || typeof game !== 'object') {
      console.error(`Invalid game object: ${JSON.stringify(game)}`);
      console.log('Invalid game object:', game);
      continue;
    }

    try {
      const title = game.name;
      if (!title) {
        console.error('Game title is undefined or empty');
        continue;
      }

      const description = stripHtmlTags(game.description) || '';
      const genre = game.genres?.map((g: any) => g.name).join(', ') || null;
      const tags = JSON.stringify(game.tags?.map((tag: any) => tag.name) || []);
      const platforms = JSON.stringify(
        game.platforms?.map((p: any) => p.platform.name) || []
      );
      const playtime_estimate = game.playtime || 0;
      const developer =
        game.developers?.length > 0 ? game.developers[0].name : 'Unknown';
      const publisher =
        game.publishers?.length > 0 ? game.publishers[0].name : 'Unknown';

      // Validate and determine game_mode
      const lowerCasePlatforms = platforms.toLowerCase();
      let game_mode: string = 'single-player';
      if (lowerCasePlatforms.includes('multiplayer')) {
        game_mode = 'multiplayer';
      } else if (lowerCasePlatforms.includes('both')) {
        game_mode = 'both';
      }

      // Validate and clamp review_rating
      const rawRating = game.rating || 0;
      const review_rating = Math.min(Math.max(Math.round(rawRating), 1), 10);

      const release_date = game.released;
      const cover_image = game.background_image;

      // Check if the game already exists
      const checkQuery = 'SELECT * FROM games WHERE title = ?';
      const [rows] = await pool.query<RowDataPacket[]>(checkQuery, [title]);

      if (rows.length > 0) {
        console.log(`Game "${title}" already exists in the database.`);
        continue;
      }

      gamesToInsert.push([
        title,
        description,
        genre,
        tags,
        platforms,
        playtime_estimate,
        developer,
        publisher,
        game_mode,
        release_date,
        review_rating,
        cover_image,
      ]);
    } catch (error) {
      console.error(`Error processing game "${game?.name}":`, error);
    }
  }

  if (gamesToInsert.length > 0) {
    try {
      const insertQuery = `
        INSERT INTO games (title, description, genre, tags, platforms, playtime_estimate, developer, publisher, game_mode, release_date, review_rating, cover_image)
        VALUES ?
      `;
      await pool.query(insertQuery, [gamesToInsert]);
      console.log(`${gamesToInsert.length} new games added to the database.`);
    } catch (error) {
      console.error('Error inserting games into the database:', error);
    }
  } else {
    console.log('No new games to add.');
  }
};

const fetchNewGames = async (maxFetch: number = 50): Promise<any[]> => {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const today = new Date();

  const startDate = tenDaysAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  try {
    const response = await fetch(
      `https://api.rawg.io/api/games?dates=${startDate},${endDate}&key=${RAWG_API_KEY}&page_size=${maxFetch}`
    );
    if (!response.ok) {
      console.error(`Failed to fetch new games: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data.results.slice(0, maxFetch) || [];
  } catch (error) {
    console.error('Error fetching new games:', error);
    return [];
  }
};

const testAddGames = async () => {
  const amountOfGames = 150;

  try {
    console.log('Fetching new games...');

    // const gamesData = await fetchNewGames(amountOfGames);

    const gamesData = await getMostPopularGames(amountOfGames);

    if (gamesData.length > 0) {
      console.log(
        `Fetched ${gamesData.length} games. Adding them to the database...`
      );

      await addNewGamesToDatabase(gamesData);

      console.log('Test games added successfully.');
    } else {
      console.log('No new games fetched.');
    }
  } catch (error) {
    console.error('Error during testAddGames:', error);
  }
};

// const testAddGames = async () => {
//   const testIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
//   const gamesData = [];

//   for (const gameId of testIds) {
//     const gameData = await getGameById(gameId);
//     if (gameData) {
//       gamesData.push(gameData);
//     } else {
//       console.error(`Game with ID ${gameId} could not be fetched.`);
//     }
//   }

//   if (gamesData.length > 0) {
//     try {
//       await addNewGamesToDatabase(gamesData);
//       console.log('Test games added successfully.');
//     } catch (error) {
//       console.error('Error while adding games:', error);
//     }
//   } else {
//     console.log('No games fetched to add.');
//   }
// };

// const fetchAndAddGamesJob = new CronJob(
//   '0 0 */10 * *', // Runs every 10 days at midnight
//   async () => {
//     console.log('Cron job started: Fetching new games...');

//     try {
//       // Fetch the new games (max 50 by default)
//       const newGames = await fetchNewGames(50);

//       if (newGames.length === 0) {
//         console.log('No new games fetched.');
//         return;
//       }

//       console.log(`Fetched ${newGames.length} games. Adding them to the database...`);

//       // Add the fetched games to the database
//       await addNewGamesToDatabase(newGames);

//       console.log('Successfully added new games to the database.');
//     } catch (error) {
//       console.error('Error in the cron job while fetching or adding games:', error);
//     }
//   },
//   null, // No "onComplete" callback
//   true, // Start the job immediately
//   'America/Los_Angeles' // Time zone
// );

export {
  getGameById,
  addNewGamesToDatabase,
  fetchNewGames,
  testAddGames,
  getMostPopularGames,
  searchGamesOnRAWG,
  convertRAWGGameToDBFormat,
};
