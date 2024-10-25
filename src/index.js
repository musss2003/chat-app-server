require('dotenv').config();
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const userRoutes = require("./routes/users");
const Message = require('./models/Message');
const auth = require('./middlewares/auth');
const User = require('./models/user');
const getLastMessages = require('./routes/messages');
const app = express();
const server = http.createServer(app);

const users = {}; // In-memory store for online users

mongoose
    .connect(process.env.DB_CONNECTION)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log("MongoDB connection error:", err));

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", auth, userRoutes);

const io = socketIO(server, {
    cors: {
        origin: process.env.BASE_URL,
        methods: ["GET", "POST"],
    },
});

// Handle incoming socket connections
io.on("connection", (socket) => {

    // Joining a room for a private 1:1 chat
    socket.on('joinRoom', ({ userId, selectedUserId }) => {
        if(selectedUserId){
            const roomId = [userId, selectedUserId].sort().join('-'); // Unique room for both users
            socket.join(roomId);
            console.log(`User ${userId} joined room ${roomId}`);
        }else{
            socket.join(userId); // Join user's individual room
            console.log(`User ${userId} joined their own room`);
        }
    });

    // Example server-side code for handling typing events
    socket.on('typing', ({ senderId, receiverId }) => {
        // Emit to the room both users share (roomId could be unique based on the two users)
        const roomId = [senderId, receiverId].sort().join('-');
        socket.to(receiverId).emit('typing', { senderId }); // Directly to receiver's room
        socket.to(roomId).emit('typing', { senderId });
        console.log(`${senderId} is typing...`);
    });

    socket.on('stopTyping', ({ senderId, receiverId }) => {
        // Emit to the room both users share (roomId could be unique based on the two users)
        const roomId = [senderId, receiverId].sort().join('-');
        socket.to(receiverId).emit('stopTyping', { senderId }); // Directly to receiver's room
        socket.to(roomId).emit('stopTyping', { senderId });
    });


    // Listening for new messages
    socket.on('sendMessage', async (messageData) => {
        try {
            // Save the message to the database
            const newMessage = new Message({
                sender: messageData.sender,
                receiver: messageData.receiver,
                content: messageData.content,
                timestamp: new Date(),
                read: false,
            });

            await newMessage.save();

            // Broadcast the message to the room
            const roomId = [messageData.sender, messageData.receiver].sort().join('-');

            io.to(roomId).emit('receiveMessage', newMessage); // Emit to both users in the room

            io.to(messageData.receiver).emit('refreshChatList', 'Chat list should be refreshed.'); // Emit to the receiver alone

        } catch (error) {
            console.error('Error saving or sending message:', error);
        }
    });

    socket.on('userOnline', async (userId) => {
        const user = await User.findById(userId);
        user.timeStamp = new Date();
        await user.save();
        users[userId] = socket.id;

        io.emit('updateUserStatus', { userId, status: 'online' });
    });

    // Marking messages as read (optional feature)
    socket.on('markMessagesAsRead', async ({ userId, selectedUserId }) => {
        await Message.updateMany(
            { sender: selectedUserId, receiver: userId, read: false },
            { $set: { read: true } }
        );

        io.to(userId).emit('refreshChatList', 'Chat list should be refreshed.'); // Emit to the receiver alone

        console.log(`Marked messages as read from user ${selectedUserId} to user ${userId}`);

    });

    // When a user disconnects
    socket.on('disconnect', () => {
        for (let userId in users) {
            if (users[userId] === socket.id) {
                delete users[userId];
                io.emit('updateUserStatus', { userId, status: 'offline' });
                break;
            }
        }
    });
});


const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});