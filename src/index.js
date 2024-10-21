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

mongoose
    .connect(process.env.DB_CONNECTION, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
        socketTimeoutMS: 45000, // Increase socket timeout to 45 seconds
    })
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
    console.log('User connected:', socket.id);

    // Joining a room for a private 1:1 chat
    socket.on('joinRoom', ({ userId, selectedUserId }) => {
        const roomId = [userId, selectedUserId].sort().join('-'); // Create a unique room ID
        socket.join(roomId);
        console.log(`User ${userId} joined room: ${roomId}`);
    });

        // Joining a room for a listening to a user alone
        socket.on('joinRoomAlone', ({ userId }) => {
            socket.join(userId);
            console.log(`User ${userId} joined room: ${userId}`);
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
            console.log(messageData.receiver + ' should refresh chat list');
        } catch (error) {
            console.error('Error saving or sending message:', error);
        }
    });
    socket.on('userOnline', async (userId) => {
        const user = await User.findById(userId);
        user.timeStamp = new Date();
        await user.save();
        console.log(`User ${user.username} is online`);
    });

    // Marking messages as read (optional feature)
    socket.on('markMessagesAsRead', async ({ userId, chatId }) => {
        await Message.updateMany(
            { sender: chatId, receiver: userId, read: false },
            { $set: { read: true } }
        );
    });

    // When a user disconnects
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});


const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});