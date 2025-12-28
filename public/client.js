const socket = io();

// UI Elements
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');
const welcomeMsg = document.getElementById('welcome-message');
const playerList = document.getElementById('player-list');
const hostControls = document.getElementById('host-controls');
const totalPlayersInput = document.getElementById('total-players');
const wolfCountInput = document.getElementById('wolf-count');
const setConfigBtn = document.getElementById('set-config-btn');
const startGameBtn = document.getElementById('start-game-btn');
const reqPlayersSpan = document.getElementById('req-players');
const reqWolvesSpan = document.getElementById('req-wolves');
const roleName = document.getElementById('role-name');
const roleDesc = document.getElementById('role-desc');
const startError = document.getElementById('start-error');

const ROLE_DESCRIPTIONS = {
    'Villager': 'Warga Desa. Tugasmu adalah menemukan siapa Werewolf di antara kalian. Ikuti diskusi dan voting dengan bijak.',
    'Werewolf': 'Werewolf. Tiap malam kamu bisa memilih satu warga untuk dimangsa. Siang hari, berbaurlah agar tidak ketahuan.',
    'Seer': 'Penerawang. Tiap malam kamu bisa melihat peran asli dari satu pemain pilihanmu. Gunakan informasimu untuk membantu warga.',
    'Guardian': 'Pelindung. Tiap malam kamu bisa memilih satu pemain untuk dilindungi dari serangan Werewolf. Kamu tidak bisa melindungi orang yang sama dua malam berturut-turut.'
};

// Join Game
joinBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        socket.emit('join', name);
        loginScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        welcomeMsg.textContent = `Welcome, ${name}`;
    }
});

// Host Controls
setConfigBtn.addEventListener('click', () => {
    const config = {
        totalPlayers: parseInt(totalPlayersInput.value),
        wolfCount: parseInt(wolfCountInput.value)
    };
    socket.emit('setConfig', config);
});

startGameBtn.addEventListener('click', () => {
    startError.textContent = ''; // Clear previous errors
    socket.emit('startGame');
});

// Socket Events
socket.on('gameState', (state) => {
    updateLobby(state.players);
    updateConfig(state.config);
    if (state.started) {
        showGameScreen();
    }
    if (state.isHost) {
        hostControls.classList.remove('hidden');
    }
});

socket.on('updatePlayers', (players) => {
    updateLobby(players);
});

socket.on('isHost', (isHost) => {
    if (isHost) {
        hostControls.classList.remove('hidden');
    }
});

socket.on('configUpdated', (config) => {
    updateConfig(config);
});

socket.on('gameStarted', () => {
    showGameScreen();
});

socket.on('roleAssigned', (role) => {
    roleName.textContent = role;
    roleDesc.textContent = ROLE_DESCRIPTIONS[role] || 'Peran misterius...';
});

socket.on('error', (msg) => {
    // Show error in the UI instead of alert if possible, or fallback
    if (startError && !gameScreen.classList.contains('active')) {
        startError.textContent = msg;
    } else {
        alert(msg);
    }
});

// Helpers
function updateLobby(players) {
    playerList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name + (p.role ? ' (Ready)' : '');
        playerList.appendChild(li);
    });
}

function updateConfig(config) {
    reqPlayersSpan.textContent = config.totalPlayers;
    reqWolvesSpan.textContent = config.wolfCount;
    // Update inputs if not host (sync) - optional, for now just display
}

function showGameScreen() {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}
