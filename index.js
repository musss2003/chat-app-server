const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: 'http://localhost:3000', // Your React app URL
        methods: ['GET', 'POST']
    }
});

// Handle incoming socket connections
io.on('connection', (socket) => {
    console.log('New user connected');

    socket.on('sendMessage', (message) => {
        io.emit('receiveMessage', message); // Broadcast the message to all connected clients
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('typing', (username) => {
        socket.broadcast.emit('typing', username);
    });
    
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
