import { testAddGames, getMostPopularGames, addNewGamesToDatabase } from '../src/api/rawg';
import { connectUserDB, getPool } from '../src/connections/database';
import dotenv from 'dotenv';

dotenv.config();

// Connect to database
connectUserDB();

const populateGamesWithRealData = async () => {
  const pool = getPool();
  
  try {
    console.log('Clearing old games to fetch trending ones...');
    // Clear all games to get fresh trending data
    await pool.query("DELETE FROM games");
    console.log('Old games cleared.');
    
    console.log('Fetching trending games from RAWG API...');
    // Fetch and add trending games (ordered by -added for most recently trending)
    await testAddGames();
    
    console.log('Successfully populated games with trending data!');
    console.log('Refresh your browser to see the trending games!');
    process.exit(0);
  } catch (error) {
    console.error('Error populating games:', error);
    process.exit(1);
  }
};

populateGamesWithRealData();

