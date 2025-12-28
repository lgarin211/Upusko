
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let gameConfig = {
    totalPlayers: 0,
    wolfCount: 0
};
let gameStarted = false;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send current state to new player
    socket.emit('gameState', {
        players: players,
        config: gameConfig,
        started: gameStarted,
        isHost: players.length === 0 // First player is host
    });

    socket.on('join', (playerName) => {
        if (gameStarted) {
            socket.emit('error', 'Game already started');
            return;
        }

        const existingPlayer = players.find(p => p.id === socket.id);
        if (existingPlayer) {
            existingPlayer.name = playerName;
        } else {
            players.push({ id: socket.id, name: playerName, role: null });
        }

        io.emit('updatePlayers', players);

        // If this was the first player, tell them they are host
        if (players.length === 1) {
            socket.emit('isHost', true);
        }
    });

    socket.on('setConfig', (config) => {
        // Ideally checking if sender is host, but for simplicity allowing update
        gameConfig = config;
        io.emit('configUpdated', gameConfig);
    });

    socket.on('startGame', () => {
        if (players.length < gameConfig.totalPlayers) {
            socket.emit('error', `Waiting for more players. Need ${gameConfig.totalPlayers}, have ${players.length}`);
            return;
        }

        assignRoles();
        gameStarted = true;
        io.emit('gameStarted');

        // Reveal roles
        players.forEach(player => {
            io.to(player.id).emit('roleAssigned', player.role);
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayers', players);

        // If host disconnected, assign new host if any players remain
        if (players.length > 0) {
            io.to(players[0].id).emit('isHost', true);
        } else {
            // Reset game if everyone leaves
            gameStarted = false;
        }
    });
});

function assignRoles() {
    let roles = [];

    // Always add Wolves
    for (let i = 0; i < gameConfig.wolfCount; i++) {
        roles.push('Werewolf');
    }

    // Add Special Roles if enough players (Logic: Need enough villagers to hide)
    // Seer needs at least wolfCount + 2 players total usually, but let's be flexible
    // Rule: If remaining slots > 0, add Seer.
    if (roles.length < players.length) {
        roles.push('Seer');
    }

    // Guardian if we still have space
    if (roles.length < players.length) {
        roles.push('Guardian');
    }

    // Fill the rest with Villagers
    while (roles.length < players.length) {
        roles.push('Villager');
    }

    // Shuffle roles
    roles = roles.sort(() => Math.random() - 0.5);

    // Assign to players
    players.forEach((player, index) => {
        player.role = roles[index];
    });

    console.log("Roles assigned:", players.map(p => `${p.name}: ${p.role}`));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
