const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
db.initDB();

io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    try {
        const players = await db.getPlayers();
        const gameState = await db.getGameState();

        // Convert config from JSON if needed (mysql2 handles this but checks safety)
        let config = gameState.config;
        if (typeof config === 'string') config = JSON.parse(config);

        // Send current state to new player
        socket.emit('gameState', {
            players: players,
            config: config,
            started: gameState.status === 'playing',
            isHost: players.length === 0 // This logic might need tweak since DB persists, but on connect if no players in DB, first one is host.
        });
    } catch (e) {
        console.error("Error fetching initial state:", e);
    }

    socket.on('join', async (playerName) => {
        try {
            const gameState = await db.getGameState();
            if (gameState.status === 'playing') {
                socket.emit('error', 'Game already started');
                return;
            }

            const players = await db.getPlayers();
            // Check if player already exists (by socket ID simple check) - technically new socket ID on reconnect
            // For now, just add new player

            const isFirst = players.length === 0;
            await db.addPlayer(socket.id, playerName, isFirst);

            const updatedPlayers = await db.getPlayers();
            io.emit('updatePlayers', updatedPlayers);

            if (isFirst) {
                socket.emit('isHost', true);
            }
        } catch (e) {
            console.error("Error joining:", e);
        }
    });

    socket.on('setConfig', async (config) => {
        try {
            await db.updateGameConfig(config);
            io.emit('configUpdated', config);
        } catch (e) {
            console.error("Error setting config:", e);
        }
    });

    socket.on('startGame', async () => {
        try {
            const players = await db.getPlayers();
            const gameState = await db.getGameState();
            let config = gameState.config;
            if (typeof config === 'string') config = JSON.parse(config);

            if (players.length < config.totalPlayers) {
                socket.emit('error', `Waiting for more players. Need ${config.totalPlayers}, have ${players.length}`);
                return;
            }

            await assignRoles(players, config);
            await db.updateGameStatus('playing');

            io.emit('gameStarted');

            // Reveal roles and update DB
            const updatedPlayers = await db.getPlayers(); // fetch again to get roles
            updatedPlayers.forEach(player => {
                // Find socket to emit to
                io.to(player.socket_id).emit('roleAssigned', player.role);
            });
        } catch (e) {
            console.error("Error starting game:", e);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        try {
            await db.removePlayer(socket.id);
            const players = await db.getPlayers();

            io.emit('updatePlayers', players);

            // If host left, assign new host (logic simplification: if anyone remains, make the first one host)
            if (players.length > 0) {
                // Creating a 'host' flag in DB would be better, but for now just tell the first one
                io.to(players[0].socket_id).emit('isHost', true);
            } else {
                // Reset game if everyone leaves
                await db.updateGameStatus('waiting');
            }
        } catch (e) {
            console.error("Error disconnecting:", e);
        }
    });
});

async function assignRoles(players, config) {
    let roles = [];

    // Always add Wolves
    for (let i = 0; i < config.wolfCount; i++) {
        roles.push('Werewolf');
    }

    if (roles.length < players.length) {
        roles.push('Seer');
    }

    if (roles.length < players.length) {
        roles.push('Guardian');
    }

    while (roles.length < players.length) {
        roles.push('Villager');
    }

    // Shuffle roles
    roles = roles.sort(() => Math.random() - 0.5);

    // Assign to players in DB
    for (let i = 0; i < players.length; i++) {
        await db.updatePlayerRole(players[i].socket_id, roles[i]);
    }

    console.log("Roles assigned");
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
