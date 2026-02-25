import { getPool } from '../connections/database';
import { Game as GameInterface } from '../interfaces/Game';

class Game {
  addGame = async (
    game: Omit<GameInterface, 'game_id' | 'created_at' | 'updated_at'>
  ): Promise<void> => {
    const sql = `
      INSERT INTO games (title, description, genre, tags, platforms, playtime_estimate, developer, publisher, game_mode, release_date, review_rating, cover_image, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const pool = getPool();
    const values = [
      game.title,
      game.description,
      game.genre,
      JSON.stringify(game.tags),
      JSON.stringify(game.platforms),
      game.playtime_estimate,
      game.developer,
      game.publisher,
      game.game_mode,
      game.release_date,
      game.review_rating,
      game.cover_image,
    ];

    await pool.query(sql, values);
  };

  findGames = async (
    query: string = '',
    genres: string = '',
    minReviewRating: number = 0,
    gameMode?: GameInterface['game_mode']
  ): Promise<GameInterface[]> => {
    const pool = getPool();
    let sql = 'SELECT * FROM games WHERE 1=1';
    const values: (string | number)[] = [];

    if (query) {
      // Use case-insensitive search
      sql += ' AND LOWER(title) LIKE LOWER(?)';
      values.push(`%${query}%`);
    }

    if (genres) {
      const genreList = genres.split(',').map(g => g.trim());
      sql += ' AND (' + genreList.map(() => 'genre LIKE ?').join(' OR ') + ')';
      values.push(...genreList.map(genre => `%${genre}%`));
    }

    if (minReviewRating) {
      sql += ' AND review_rating >= ?';
      values.push(minReviewRating);
    }

    if (gameMode) {
      sql += ' AND game_mode = ?';
      values.push(gameMode);
    }

    // Order by relevance: exact match first, then starts with, then contains
    if (query) {
      sql += ` ORDER BY 
        CASE 
          WHEN LOWER(title) = LOWER(?) THEN 1
          WHEN LOWER(title) LIKE LOWER(?) THEN 2
          ELSE 3
        END,
        review_rating DESC,
        updated_at DESC`;
      values.push(query, `${query}%`);
    } else {
      sql += ' ORDER BY review_rating DESC, updated_at DESC';
    }

    const [rows] = await pool.query(sql, values);
    return rows as GameInterface[];
  };

  deleteGame = async (gameId: number): Promise<void> => {
    const sql = 'DELETE FROM games WHERE game_id = ?';
    const pool = getPool();
    await pool.query(sql, [gameId]);
  };

  updateGame = async (
    gameId: number,
    updates: Partial<GameInterface>
  ): Promise<void> => {
    const fields = [];
    const values: (string | number)[] = [];
    const pool = getPool();

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'tags' || key === 'platforms') {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`);
        values.push(value as string | number);
      }
    }
    values.push(gameId);

    const sql = `UPDATE games SET ${fields.join(', ')} WHERE game_id = ?`;
    await pool.query(sql, values);
  };

  getGameById = async (gameId: number): Promise<GameInterface | null> => {
    const sql = 'SELECT * FROM games WHERE game_id = ?';
    const pool = getPool();
    const [rows] = await pool.query(sql, [gameId]);

    return (rows as GameInterface[])[0] || null;
  };

  getAllGames = async (limit?: number): Promise<GameInterface[]> => {
    const pool = getPool();
    let sql = 'SELECT * FROM games';
    
    if (limit && limit > 0) {
      sql += ' LIMIT ?';
      console.log(`Executing SQL: ${sql} with limit = ${limit}`);
      const [rows] = await pool.query(sql, [limit]);
      return rows as GameInterface[];
    } else {
      console.log(`Executing SQL: ${sql} (no limit - getting all games)`);
      const [rows] = await pool.query(sql);
      return rows as GameInterface[];
    }
  };

  getTopRatedGames = async (limit: number): Promise<GameInterface[]> => {
    // Order by most recently added/updated first (trending), then by rating
    // This shows recently trending games rather than obscure high-rated ones
    const sql = `
      SELECT * FROM games
      ORDER BY updated_at DESC, created_at DESC, review_rating DESC
      LIMIT ?
    `;
    const pool = getPool();
    const [rows] = await pool.query(sql, [limit]);
    return rows as GameInterface[];
  };

  getRandomGames = async (limit: number): Promise<GameInterface[]> => {
    const sql = `
      SELECT *
      FROM games
      ORDER BY RAND()
      LIMIT ?
    `;
    const pool = getPool();
    const [rows] = await pool.query(sql, [limit]);
    return rows as GameInterface[];
  };
}

export default Game;
