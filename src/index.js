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

const app = express();
const server = http.createServer(app);

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
    console.log("New user connected");

    socket.on("sendMessage", async (messageData) => {
        const message = new Message({
            content: messageData.content,
            sender: messageData.sender,
            receiver: messageData.receiver,
        });

        try {
            await message.save();
            io.emit("receiveMessage", message);
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});