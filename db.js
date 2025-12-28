
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDB() {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to database');

        // Players table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                socket_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(50),
                is_host BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Game State table (Singleton)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS game_state (
                id INT PRIMARY KEY,
                status VARCHAR(50) DEFAULT 'waiting',
                config JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Initialize state if not exists
        const [rows] = await connection.query('SELECT * FROM game_state WHERE id = 1');
        if (rows.length === 0) {
            await connection.query(`
                INSERT INTO game_state (id, status, config) 
                VALUES (1, 'waiting', '{"totalPlayers": 5, "wolfCount": 1}')
            `);
        }

        // Clean up stale players on restart (Optionally, or just keep them)
        // For this simple implementation, we'll clear players on server start 
        // to avoid mismatch with memory if we were fully stateless, 
        // but since we want "persistence", we might want to keep them.
        // However, socket IDs change on reconnect, so clearing is safer for now 
        // unless we implement session tokens.
        await connection.query('TRUNCATE TABLE players');

        connection.release();
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
}

async function getPlayers() {
    const [rows] = await pool.query('SELECT * FROM players');
    return rows;
}

async function addPlayer(socketId, name, isHost = false) {
    await pool.query('INSERT INTO players (socket_id, name, is_host) VALUES (?, ?, ?)', [socketId, name, isHost]);
}

async function updatePlayerRole(socketId, role) {
    await pool.query('UPDATE players SET role = ? WHERE socket_id = ?', [role, socketId]);
}

async function removePlayer(socketId) {
    await pool.query('DELETE FROM players WHERE socket_id = ?', [socketId]);
}

async function getGameState() {
    const [rows] = await pool.query('SELECT * FROM game_state WHERE id = 1');
    return rows[0];
}

async function updateGameConfig(config) {
    await pool.query('UPDATE game_state SET config = ? WHERE id = 1', [JSON.stringify(config)]);
}

async function updateGameStatus(status) {
    await pool.query('UPDATE game_state SET status = ? WHERE id = 1', [status]);
}

module.exports = {
    initDB,
    getPlayers,
    addPlayer,
    updatePlayerRole,
    removePlayer,
    getGameState,
    updateGameConfig,
    updateGameStatus
};
