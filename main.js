// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCvF2BV5MBU6AMQOByD9Q5g4wZXF0a9W1g",
    authDomain: "movement-player.firebaseapp.com",
    projectId: "movement-player",
    storageBucket: "movement-player.appspot.com",
    messagingSenderId: "55543297155",
    appId: "1:55543297155:web:b8ef612f7041bcab7617b6",
    measurementId: "G-0PPZM7EXZM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loginContainer = document.getElementById('login-container');
const gameContainer = document.getElementById('game-container');
const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');
const toggleLoginSignup = document.getElementById('toggle-login-signup');
const btnLogin = document.getElementById('btn-login');
const btnSignup = document.getElementById('btn-signup');
const playBtn = document.getElementById('play-btn');
const tabs = document.querySelectorAll('.tab');
const saveNameBtn = document.getElementById('save-name-btn');
const saveColorBtn = document.getElementById('save-color-btn');
const createLobbyBtn = document.getElementById('create-lobby-btn');
const lobbyList = document.getElementById('lobby-list');

// Current user data
let currentUser = null;
let userData = {};
let currentLobbyId = null;
let lobbyListener = null;
let chatListener = null;

// Toggle password visibility
togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.querySelector('i').classList.toggle('fa-eye');
    this.querySelector('i').classList.toggle('fa-eye-slash');
});

// Toggle between login and signup
toggleLoginSignup.addEventListener('click', function() {
    const isLogin = btnLogin.style.display !== 'none';
    if (isLogin) {
        btnLogin.style.display = 'none';
        btnSignup.style.display = 'block';
        toggleLoginSignup.textContent = 'Already have an account? Login now!';
    } else {
        btnLogin.style.display = 'block';
        btnSignup.style.display = 'none';
        toggleLoginSignup.textContent = 'Don\'t have an account? Sign up now!';
    }
});

// Login functionality
btnLogin.addEventListener('click', function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (email && password) {
        // Firebase login
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in 
                currentUser = userCredential.user;
                loadUserData();
            })
            .catch((error) => {
                alert('Login error: ' + error.message);
            });
    } else {
        alert('Please enter both email and password');
    }
});

// Signup functionality
btnSignup.addEventListener('click', function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (email && password) {
        // Firebase signup
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed up
                currentUser = userCredential.user;
                
                // Create user document in Firestore
                return db.collection('users').doc(currentUser.uid).set({
                    email: email,
                    displayName: email.split('@')[0],
                    color: '#FF5555',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .then(() => {
                loadUserData();
            })
            .catch((error) => {
                alert('Signup error: ' + error.message);
            });
    } else {
        alert('Please enter both email and password');
    }
});

// Load user data from Firestore
function loadUserData() {
    db.collection('users').doc(currentUser.uid).get()
        .then((doc) => {
            if (doc.exists) {
                userData = doc.data(); // <-- This updates to the correct account
                
                // Update UI elements
                document.getElementById('player-name').textContent = userData.displayName;
                document.getElementById('player-id').textContent = currentUser.uid.substring(0, 8).toUpperCase();
                
                // Show game container
                loginContainer.style.display = 'none';
                gameContainer.style.display = 'flex';
                
                // Load lobbies
                loadLobbies();
            }
        });
}

// Save name changes
saveNameBtn.addEventListener('click', function() {
    const newName = document.getElementById('change-name').value;
    
    if (newName && newName !== userData.displayName) {
        db.collection('users').doc(currentUser.uid).update({
            displayName: newName
        })
        .then(() => {
            userData.displayName = newName;
            document.getElementById('player-name').textContent = newName;
            
            // Update name in lobby if user is in one
            if (currentLobbyId) {
                updatePlayerInLobby();
            }
            
            alert('Name updated successfully!');
        })
        .catch((error) => {
            alert('Error updating name: ' + error.message);
        });
    }
});

// Save color changes
saveColorBtn.addEventListener('click', function() {
    const selectedColor = document.querySelector('.color-option.selected').style.backgroundColor;
    
    if (selectedColor !== userData.color) {
        db.collection('users').doc(currentUser.uid).update({
            color: selectedColor
        })
        .then(() => {
            userData.color = selectedColor;
            
            // Update color in lobby if user is in one
            if (currentLobbyId) {
                updatePlayerInLobby();
            }
            
            alert('Color updated successfully!');
        })
        .catch((error) => {
            alert('Error updating color: ' + error.message);
        });
    }
});

// Update player info in the current lobby
function updatePlayerInLobby() {
    if (!currentLobbyId) return;
    
    db.collection('lobbies').doc(currentLobbyId).get()
        .then((doc) => {
            if (doc.exists) {
                const lobby = doc.data();
                const playerIndex = lobby.players.findIndex(p => p.id === currentUser.uid);
                
                if (playerIndex !== -1) {
                    // Remove old player data
                    const updatedPlayers = [...lobby.players];
                    updatedPlayers[playerIndex] = {
                        id: currentUser.uid,
                        name: userData.displayName,
                        color: userData.color,
                        isHost: updatedPlayers[playerIndex].isHost
                    };
                    
                    // Update players array
                    return db.collection('lobbies').doc(currentLobbyId).update({
                        players: updatedPlayers
                    });
                }
            }
        })
        .catch((error) => {
            console.error("Error updating player in lobby:", error);
        });
}

// Create lobby
createLobbyBtn.addEventListener('click', function() {
    const lobbyName = document.getElementById('lobby-name').value;
    const maxPlayers = document.getElementById('max-players').value;
    const isPublic = document.getElementById('public-lobby').checked;
    
    if (!lobbyName) {
        alert('Please enter a lobby name');
        return;
    }
    
    const lobbyData = {
        name: lobbyName,
        maxPlayers: parseInt(maxPlayers),
        isPublic: isPublic,
        hostId: currentUser.uid,
        hostName: userData.displayName,
        players: [{
            id: currentUser.uid,
            name: userData.displayName,
            color: userData.color,
            isHost: true
        }],
        status: 'waiting',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('lobbies').add(lobbyData)
        .then((docRef) =>{
            currentLobbyId = docRef.id;
            alert('Lobby created successfully!');
            setupLobbyListener();
            setupChatListener();
            showLobbyView();
        })
        .catch((error) => {
            alert('Error creating lobby: ' + error.message);
        });
});

// Load lobbies from Firestore (fixed query)
function loadLobbies() {
    // Clear existing lobbies
    lobbyList.innerHTML = '';
    
    // Use a simpler query to avoid index requirements
    db.collection('lobbies')
        .where('status', '==', 'waiting')
        .limit(10)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                lobbyList.innerHTML = '<p>No public lobbies available. Create one!</p>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const lobby = doc.data();
                
                // Skip non-public lobbies
                if (!lobby.isPublic) return;
                
                // Skip full lobbies
                if (lobby.players && lobby.players.length >= lobby.maxPlayers) return;
                
                const lobbyElement = document.createElement('div');
                lobbyElement.className = 'lobby-card';
                lobbyElement.dataset.id = doc.id;
                
                lobbyElement.innerHTML = `
                    <div class="lobby-name">${lobby.name}</div>
                    <div class="lobby-players">
                        ${lobby.players ? lobby.players.map(player => 
                            `<div class="player-circle" style="background-color: ${player.color || '#4e4e8d'}">${player.name ? player.name.charAt(0) : '?'}</div>`
                        ).join('') : ''}
                        ${Array(lobby.maxPlayers - (lobby.players ? lobby.players.length : 0)).fill('<div class="player-circle" style="background-color: #4e4e8d">+</div>').join('')}
                    </div>
                    <div>${lobby.players ? lobby.players.length : 0}/${lobby.maxPlayers} players</div>
                    <div>Host: ${lobby.hostName || 'Unknown'}</div>
                `;
                
                lobbyElement.addEventListener('click', () => {
                    joinLobby(doc.id);
                });
                
                lobbyList.appendChild(lobbyElement);
            });
            
            if (lobbyList.children.length === 0) {
                lobbyList.innerHTML = '<p>No public lobbies available. Create one!</p>';
            }
        })
        .catch((error) => {
            console.error("Error getting lobbies: ", error);
            lobbyList.innerHTML = '<p>Error loading lobbies. Please try again.</p>';
        });
}

// Join a lobby by ID
function joinLobbyById() {
    const lobbyIdInput = document.getElementById('join-lobby-id');
    const lobbyId = lobbyIdInput.value.trim();
    
    if (!lobbyId) {
        alert('Please enter a lobby ID');
        return;
    }
    
    // Check if lobby exists
    db.collection('lobbies').doc(lobbyId).get()
        .then((doc) => {
            if (doc.exists) {
                const lobby = doc.data();
                
                // Check if lobby is closed
                if (lobby.status === 'closed') {
                    showLobbyClosedMessage();
                    return;
                }
                
                // Check if lobby is full
                if (lobby.players && lobby.players.length >= lobby.maxPlayers) {
                    alert('This lobby is full');
                    return;
                }
                
                // Check if player is already in the lobby
                if (lobby.players && lobby.players.some(player => player.id === currentUser.uid)) {
                    alert('You are already in this lobby');
                    return;
                }
                
                // Add player to lobby
                const newPlayer = {
    id: currentUser.uid || "unknown-id",
    name: userData.displayName || "Unknown",
    color: userData.color || "#FFFFFF",
    isHost: false
};

// Only update if all required fields exist
if (newPlayer.id && newPlayer.name) {
    db.collection('lobbies').doc(lobbyId).update({
        players: firebase.firestore.FieldValue.arrayUnion(newPlayer),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert('Joined lobby successfully!');
    })
    .catch((error) => {
        console.error('Error joining lobby:', error);
    });
} else {
    alert('Cannot join lobby: missing player information.');
}
                
                return db.collection('lobbies').doc(lobbyId).update({
                    players: firebase.firestore.FieldValue.arrayUnion(newPlayer),
                    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                showLobbyClosedMessage();
            }
        })
        .then(() => {
            if (currentLobbyId) {
                currentLobbyId = lobbyId;
                alert('Joined lobby successfully!');
                setupLobbyListener();
                setupChatListener();
                showLobbyView();
            }
        })
        .catch((error) => {
            console.error("Error joining lobby: ", error);
            alert('Error joining lobby: ' + error.message);
        });
}

// Show lobby closed message
function showLobbyClosedMessage() {
    // Remove any existing message
    const existingMessage = document.getElementById('lobby-closed-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create and show message
    const message = document.createElement('div');
    message.id = 'lobby-closed-message';
    message.innerHTML = `
        <div class="lobby-closed-content">
            <p>Lobby closed <span class="sad-face">):</span></p>
            <button id="close-lobby-message-btn">×</button>
        </div>
    `;
    
    document.body.appendChild(message);
    
    // Add event listener to close button
    document.getElementById('close-lobby-message-btn').addEventListener('click', () => {
        message.remove();
    });
}

// Join a lobby
function joinLobby(lobbyId) {
    if (!currentUser || !userData) return;
    
    const newPlayer = {
        id: currentUser.uid || "unknown-id",
        name: userData.displayName || "Unknown",
        color: userData.color || "#FFFFFF",
        isHost: false
    };
    
    if (!newPlayer.id || !newPlayer.name) {
        alert('Cannot join lobby: missing player information.');
        return;
    }
    
    db.collection('lobbies').doc(lobbyId).get()
        .then(doc => {
            if (!doc.exists) {
                alert('Lobby does not exist.');
                return;
            }
            
            const lobby = doc.data();
            
            // Check if lobby is full
            if (lobby.players && lobby.players.length >= lobby.maxPlayers) {
                alert('This lobby is full');
                return;
            }
            
            // Check if player is already in the lobby
            if (lobby.players && lobby.players.some(player => player.id === currentUser.uid)) {
                alert('You are already in this lobby');
                return;
            }
            
            // Add player to lobby
            return db.collection('lobbies').doc(lobbyId).update({
                    players: firebase.firestore.FieldValue.arrayUnion(newPlayer),
                    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
                })
                .then(() => {
                    // Join success
                    currentLobbyId = lobbyId;
                    alert('Joined lobby successfully!');
                    setupLobbyListener();
                    setupChatListener();
                    showLobbyView();
                    
                    // Send system message
                    sendSystemMessage(`${newPlayer.name} joined the game!`);
                });
        })
        .catch(error => {
            console.error('Error joining lobby:', error);
            alert('Error joining lobby: ' + error.message);
        });
}

// Set up real-time listener for lobby changes
function setupLobbyListener() {
    if (lobbyListener) {
        lobbyListener(); // remove old listener
    }
    
    lobbyListener = db.collection('lobbies').doc(currentLobbyId)
        .onSnapshot((doc) => {
            if (!doc.exists) {
                alert('Lobby closed!');
                currentLobbyId = null;
                showMainMenu();
                return;
            }
            
            const lobby = doc.data();
            updateLobbyView(lobby);
            
            // If no players left, auto close
            if ((!lobby.players || lobby.players.length === 0) && currentUser.uid === lobby.hostId) {
                db.collection('lobbies').doc(currentLobbyId).delete()
                    .then(() => {
                        alert('Lobby deleted as all players left.');
                        currentLobbyId = null;
                        showMainMenu();
                    })
                    .catch((error) => console.error('Error deleting lobby:', error));
            }
        }, (error) => {
            console.error('Lobby listener error:', error);
        });
}

// Set up real-time chat listener
function setupChatListener() {
    if (chatListener) {
        chatListener(); // Remove previous listener
    }
    
    // Create messages subcollection if it doesn't exist
    const messagesRef = db.collection('lobbies').doc(currentLobbyId).collection('messages');
    
    chatListener = messagesRef
        .orderBy('timestamp', 'asc')
        .onSnapshot((querySnapshot) => {
            const chatMessages = document.getElementById('chat-messages');
            if (!chatMessages) return;
            
            chatMessages.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const message = doc.data();
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                
                if (message.type === 'system') {
                    messageElement.classList.add('system');
                    messageElement.textContent = message.text;
                } else {
                    messageElement.innerHTML = `
                        <strong style="color: ${message.color || '#FFFFFF'}">${message.sender || 'Unknown'}:</strong> ${message.text}
                    `;
                }
                
                chatMessages.appendChild(messageElement);
            });
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, (error) => {
            console.error("Chat listener error: ", error);
        });
}

// Send a chat message
function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message || !currentLobbyId) return;
    
    const senderName = (userData.displayName || 'Unknown');
    const senderColor = (userData.color || '#FFFFFF');
    
    db.collection('lobbies').doc(currentLobbyId).collection('messages').add({
            sender: senderName,
            text: message,
            color: senderColor,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => chatInput.value = '')
        .catch(console.error);
}

// Send a system message
function sendSystemMessage(text) {
    if (currentLobbyId) {
        db.collection('lobbies').doc(currentLobbyId).collection('messages').add({
            type: 'system',
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .catch((error) => {
            console.error("Error sending system message: ", error);
        });
    }
}

// Copy game ID to clipboard
function copyGameId() {
    const gameIdElement = document.getElementById('game-id-value');
    if (gameIdElement) {
        navigator.clipboard.writeText(currentLobbyId)
            .then(() => {
                const copyBtn = document.getElementById('copy-game-id-btn');
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '✓ Copied!';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            })
            .catch((error) => {
                console.error('Error copying game ID: ', error);
            });
    }
}

// Update lobby view with current data
function updateLobbyView(lobby) {
    const lobbyPlayers = document.getElementById('lobby-players-list');
    const playerCount = document.getElementById('player-count');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameIdValue = document.getElementById('game-id-value');
    const gameIdContainer = document.getElementById('game-id-container');
    
    if (lobbyPlayers && playerCount) {
        // Update player count
        playerCount.textContent = `Players: ${lobby.players ? lobby.players.length : 0}/${lobby.maxPlayers}`;
        
        // Update player list
        lobbyPlayers.innerHTML = '';
        if (lobby.players) {
            lobby.players.forEach(player => {
                const playerElement = document.createElement('div');
                playerElement.className = 'lobby-player';
                playerElement.innerHTML = `
                    <div class="player-circle" style="background-color: ${player.color || '#4e4e8d'}">${player.name ? player.name.charAt(0) : '?'}</div>
                    <span>${player.name || 'Unknown'} ${player.isHost ? '(Host)' : ''}</span>
                `;
                lobbyPlayers.appendChild(playerElement);
            });
        }
        
        // Show game ID
        if (gameIdValue && gameIdContainer) {
            gameIdValue.textContent = currentLobbyId;
            gameIdContainer.style.display = 'block';
        }
        
        // Enable/disable start game button
        if (startGameBtn) {
            const isHost = lobby.hostId === currentUser.uid;
            const hasEnoughPlayers = lobby.players && lobby.players.length >= 3;
            
            startGameBtn.style.display = isHost ? 'block' : 'none';
            startGameBtn.disabled = !hasEnoughPlayers;
            
            if (!hasEnoughPlayers) {
                startGameBtn.title = 'Need at least 3 players to start';
            }
        }
    }
}

// Show lobby view
function showLobbyView() {
    // Hide main menu tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Show lobby view
    const lobbyView = document.getElementById('lobby-view') || createLobbyView();
    lobbyView.style.display = 'block';
    
    // Load initial lobby data
    if (currentLobbyId) {
        db.collection('lobbies').doc(currentLobbyId).get()
            .then((doc) => {
                if (doc.exists) {
                    updateLobbyView(doc.data());
                }
            })
            .catch((error) => {
                console.error("Error getting lobby data: ", error);
            });
    }
}

// Create lobby view UI
function createLobbyView() {
    const view = document.createElement('div');
    view.id = 'lobby-view';
    view.style.display = 'none';
    view.innerHTML = `
        <h2>Lobby <span id="player-count"></span></h2>
        
        <div id="game-id-container" class="game-id-container" style="display: none;">
            <span>Game ID: </span>
            <span id="game-id-value" class="game-id-value"></span>
            <button id="copy-game-id-btn" class="copy-btn">
                <i class="fas fa-copy"></i> Copy
            </button>
        </div>
        
        <div id="lobby-players-list" class="lobby-players-list"></div>
        
        <div class="chat-container">
            <h3>Chat</h3>
            <div id="chat-messages" class="chat-messages"></div>
            <div class="chat-input">
                <input type="text" id="chat-input" placeholder="Type a message...">
                <button id="send-message-btn">Send</button>
            </div>
        </div>
        
        <button id="start-game-btn" class="btn-login">Start Game</button>
        <button id="leave-lobby-btn" class="btn-signup">Leave Lobby</button>
    `;
    
    document.querySelector('.main-area .view').appendChild(view);
    
    // Add event listeners
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('leave-lobby-btn').addEventListener('click', leaveLobby);
    document.getElementById('send-message-btn').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    document.getElementById('copy-game-id-btn').addEventListener('click', copyGameId);
    
    return view;
}

// Start the game
function startGame() {
    if (!currentLobbyId) return;
    
    db.collection('lobbies').doc(currentLobbyId).get()
        .then((doc) => {
            if (doc.exists) {
                const lobby = doc.data();
                
                // Check if user is the host
                if (lobby.hostId !== currentUser.uid) {
                    alert('Only the host can start the game');
                    return;
                }
                
                // Check if there are enough players
                if (!lobby.players || lobby.players.length < 3) {
                    alert('Need at least 3 players to start');
                    return;
                }
                
                // Assign roles (1 seeker, rest hiders)
                const players = [...lobby.players];
                const seekerIndex = Math.floor(Math.random() * players.length);
                
                players.forEach((player, index) => {
                    player.role = index === seekerIndex ? 'seeker' : 'hider';
                });
                
                // Update lobby status
                return db.collection('lobbies').doc(currentLobbyId).update({
                    status: 'playing',
                    players: players,
                    startedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .then(() => {
            sendSystemMessage('Game started! Roles have been assigned.');
        })
        .catch((error) => {
            alert('Error starting game: ' + error.message);
        });
}

// Leave the current lobby
function leaveLobby() {
    if (!currentLobbyId) return;

    const lobbyRef = db.collection('lobbies').doc(currentLobbyId);

    lobbyRef.get().then(doc => {
        if (!doc.exists) return;

        let lobby = doc.data();
        const leavingPlayer = lobby.players.find(p => p.id === currentUser.uid);

        if (!leavingPlayer) return;

        // Remove leaving player
        const remainingPlayers = lobby.players.filter(p => p.id !== currentUser.uid);

        const updates = {
            players: remainingPlayers,
            lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Assign new host if leaving player was host
        if (leavingPlayer.isHost && remainingPlayers.length > 0) {
            updates.hostId = remainingPlayers[0].id;
            updates.players = remainingPlayers.map((p, i) => ({
                ...p,
                isHost: i === 0 // first player is host
            }));
        }

        // Update Firestore
        return lobbyRef.update(updates);
    }).then(() => {
        currentLobbyId = null;
        if (lobbyListener) { lobbyListener(); lobbyListener = null; }
        if (chatListener) { chatListener(); chatListener = null; }
        showMainMenu();
    }).catch(console.error);
}

// Show main menu
function showMainMenu() {
    // Hide lobby view if it exists
    const lobbyView = document.getElementById('lobby-view');
    if (lobbyView) {
        lobbyView.style.display = 'none';
    }
    
    // Show main menu tabs
    document.getElementById('lobby-tab').style.display = 'block';
    loadLobbies();
}

// Tab switching functionality
tabs.forEach(tab => {
    tab.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');
        
        // Deactivate all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Activate clicked tab
        this.classList.add('active');
        
        // Handle left panel tabs
        if (tabName === 'account' || tabName === 'customize') {
            document.getElementById('account-tab').style.display = tabName === 'account' ? 'block' : 'none';
            document.getElementById('customize-tab').style.display = tabName === 'customize' ? 'block' : 'none';
        } 
        // Handle main area tabs
        else if (tabName === 'lobby' || tabName === 'create') {
            document.getElementById('lobby-tab').style.display = tabName === 'lobby' ? 'block' : 'none';
            document.getElementById('create-tab').style.display = tabName === 'create' ? 'block' : 'none';
            
            // Load lobbies when switching to lobby tab
            if (tabName === 'lobby') {
                loadLobbies();
            }
        }
    });
});

// Color selection functionality
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');
    });
});

// Play button functionality
playBtn.addEventListener('click', function() {
    // Switch to lobby browser tab
    document.querySelector('[data-tab="lobby"]').click();
});

// Listen for auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        currentUser = user;

        // Reset userData
        userData = {};
        
        // Load current user data from Firestore
        loadUserData();
    } else {
        // User is signed out
        currentUser = null;
        userData = {};
        
        loginContainer.style.display = 'block';
        gameContainer.style.display = 'none';

        // Remove lobby/chat listeners
        if (lobbyListener) { lobbyListener(); lobbyListener = null; }
        if (chatListener) { chatListener(); chatListener = null; }
    }
});

// Initialize join by ID functionality
function initJoinById() {
    // Add join by ID section to the lobby tab
    const lobbyTab = document.getElementById('lobby-tab');
    const joinByIdHtml = `
        <div class="join-by-id-section">
            <h3>Join by Game ID</h3>
            <div class="input-group">
                <input type="text" id="join-lobby-id" placeholder="Enter Game ID">
                <button id="join-by-id-btn" class="btn-login">Join Game</button>
            </div>
        </div>
    `;
    
    // Add the join by ID section if it doesn't exist
    if (!document.querySelector('.join-by-id-section')) {
        lobbyTab.insertAdjacentHTML('afterbegin', joinByIdHtml);
        document.getElementById('join-by-id-btn').addEventListener('click', joinLobbyById);
        
        // Fix input text visibility
        const joinLobbyInput = document.getElementById('join-lobby-id');
        if (joinLobbyInput) {
            joinLobbyInput.style.width = '100%';
            joinLobbyInput.style.padding = '12px';
            joinLobbyInput.style.background = '#1a1a2e';
            joinLobbyInput.style.color = 'white';
            joinLobbyInput.style.border = '2px solid #0f3460';
            joinLobbyInput.style.borderRadius = '10px';
        }
    }
}

// Clean up inactive lobbies (would typically run on server)
function cleanupInactiveLobbies() {
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
    db.collection('lobbies')
        .where('status', '==', 'waiting')
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const lobby = doc.data();
                if (lobby.lastActivity && lobby.lastActivity.toDate() < thirtyMinutesAgo) {
                    doc.ref.update({
                        status: 'closed'
                    });
                }
            });
        })
        .catch((error) => {
            console.error("Error cleaning up lobbies: ", error);
        });
}

// Initialize the game
function initGame() {
    initJoinById();
    
    // Fix input text visibility in all inputs
    document.querySelectorAll('input').forEach(input => {
        input.style.color = 'white';
        input.style.padding = '12px';
    });
    
    // Run cleanup periodically (this would ideally be a server function)
    setInterval(cleanupInactiveLobbies, 10 * 60 * 1000); // Every 10 minutes
}

// Start initialization when page loads
document.addEventListener('DOMContentLoaded', initGame);
// Logout functionality
const logoutBtn = document.getElementById('btn-logout');
logoutBtn.addEventListener('click', () => {
  if (currentLobbyId) {
    leaveLobby(); // auto leave lobby on logout
  }
  auth.signOut()
    .then(() => {
      alert('Logged out successfully!');
      loginContainer.style.display = 'block';
      gameContainer.style.display = 'none';
    })
    .catch((error) => {
      alert('Logout error: ' + error.message);
    });
});
// Update your initGame or lobby join function
setInterval(() => {
    if (currentUser && currentLobbyId) {
        db.collection('lobbies')
            .doc(currentLobbyId)
            .collection('heartbeats')
            .doc(currentUser.uid)
            .set({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
    }
}, 10000); // every 10 seconds
function cleanupInactiveLobbies() {
    db.collection('lobbies').where('status', '==', 'waiting').get()
        .then(querySnapshot => {
            querySnapshot.forEach(async (doc) => {
                const lobbyId = doc.id;
                const heartbeatsSnap = await db.collection('lobbies')
                    .doc(lobbyId)
                    .collection('heartbeats')
                    .get();
                
                const now = new Date();
                const offlineThreshold = new Date(now - 30 * 1000); // 30 seconds
                
                let allOffline = true;
                heartbeatsSnap.forEach(hbDoc => {
                    const lastSeen = hbDoc.data().lastSeen?.toDate();
                    if (lastSeen && lastSeen > offlineThreshold) {
                        allOffline = false;
                    }
                });
                
                if (allOffline) {
                    // Close lobby and remove heartbeats
                    db.collection('lobbies').doc(lobbyId).update({ status: 'closed' });
                    heartbeatsSnap.forEach(hbDoc => hbDoc.ref.delete());
                }
            });
        })
        .catch(console.error);
}

// Run cleanup every 1 minute
setInterval(cleanupInactiveLobbies, 60 * 1000);
