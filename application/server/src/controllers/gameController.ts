// gameController.ts

import { Request, Response } from 'express';
import Game from '../models/GameModel';
import { Game as GameInterface } from '../interfaces/Game';
import { searchGamesOnRAWG, convertRAWGGameToDBFormat, addNewGamesToDatabase } from '../api/rawg';

// Instantiate Game class
const gameModel = new Game();

export const populateGames = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Allow limit to be passed as query parameter, default to 150 for more games
    const limit = parseInt(req.query.limit as string, 10) || 150;
    const sort = (req.query.sort as string) || 'trending';

    const games =
      sort === 'random'
        ? await gameModel.getRandomGames(limit)
        : await gameModel.getTopRatedGames(limit);
    if (games.length === 0) {
      res.status(404).json({ message: 'No games found' });
      return;
    }
    res.status(200).json(games);
  } catch (error) {
    console.error('Error in populateGames controller:', error);
    res.status(500).json({ message: 'Error fetching games', error });
  }
};

export const createGame = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const game: Omit<GameInterface, 'game_id' | 'created_at' | 'updated_at'> = {
      ...req.body,
      tags: req.body.tags || [],
      platforms: req.body.platforms || [],
    };
    await gameModel.addGame(game);
    res.status(201).json({ message: 'Game created successfully' });
  } catch (error) {
    console.error('Error in createGame controller:', error);
    res.status(500).json({ message: 'Error creating game', error });
  }
};

export const searchGames = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query, genre, review_rating, game_mode } = req.query;
    
    // First, search in the database
    let games = await gameModel.findGames(
      query as string,
      genre as string,
      Number(review_rating),
      game_mode as 'single-player' | 'multiplayer' | 'both'
    );

    // If no results in database and we have a search query, try RAWG API
    if (!games.length && query) {
      console.log(`No games found in database for "${query}", searching RAWG API...`);
      const rawgGames = await searchGamesOnRAWG(query as string, 20);
      
      console.log(`RAWG API returned ${rawgGames.length} games for "${query}"`);
      
      if (rawgGames.length > 0) {
        // Convert RAWG games to database format first
        const convertedGames = rawgGames.map(convertRAWGGameToDBFormat);
        
        // Add games to database (async, don't wait)
        addNewGamesToDatabase(rawgGames.slice(0, 10)).catch(err => {
          console.error('Error adding games to database:', err);
        });
        
        // Return converted games immediately with RAWG IDs
        // This ensures users get results even if database insertion fails
        games = convertedGames.map((game, index) => ({
          ...game,
          game_id: rawgGames[index].id, // Use RAWG ID as game_id
          created_at: new Date(),
          updated_at: new Date(),
        })) as GameInterface[];
        
        console.log(`Returning ${games.length} games from RAWG API for "${query}"`);
      } else {
        console.log(`No games found in RAWG API for "${query}"`);
      }
    }

    // Always return 200, even if no games found (frontend handles empty array)
    res.status(200).json(games);
  } catch (error) {
    console.error('Error in searchGames controller:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const removeGame = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { gameId } = req.params;
    await gameModel.deleteGame(Number(gameId));
    res.status(200).json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error in removeGame controller:', error);
    res.status(500).json({ message: 'Error deleting game', error });
  }
};

export const editGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const updates: Partial<GameInterface> = {
      ...req.body,
      tags: req.body.tags || [],
      platforms: req.body.platforms || [],
    };
    await gameModel.updateGame(Number(gameId), updates);
    res.status(200).json({ message: 'Game updated successfully' });
  } catch (error) {
    console.error('Error in editGame controller:', error);
    res.status(500).json({ message: 'Error updating game', error });
  }
};

export const getGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const game = await gameModel.getGameById(Number(gameId));

    if (!game) {
      res.status(404).json({ message: 'Game not found' });
    } else {
      res.status(200).json(game);
    }
  } catch (error) {
    console.error('Error in getGame controller:', error);
    res.status(500).json({ message: 'Error fetching game', error });
  }
};

export const getAllGames = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // If limit is 'all' or not provided, get all games. Otherwise use the limit.
    const limitParam = req.query.limit as string;
    let limit: number | undefined;

    if (limitParam && limitParam.toLowerCase() === 'all') {
      limit = undefined; // Get all games
    } else if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit <= 0) {
        limit = undefined; // Invalid limit, get all
      }
    } else {
      limit = 200; // Default to 200 if no limit specified
    }

    const games = await gameModel.getAllGames(limit);

    if (games.length === 0) {
      res.status(404).json({ message: 'No games found' });
      return;
    }

    res.status(200).json(games);
  } catch (error) {
    console.error('Error in getAllGames controller:', error);
    res.status(500).json({ message: 'Error fetching games', error });
  }
};
