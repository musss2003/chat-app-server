const express = require('express');
const Message = require('../models/Message');
const auth = require('../middlewares/auth');
const router = express.Router();

// Send a message
router.post('/', auth, async (req, res) => {
    const { content, receiver } = req.body;
    const sender = req.user.userId;

    const message = new Message({
        content,
        sender,
        receiver,
    });

    try {
        await message.save();
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: 'Error sending message' });
    }
});

// Fetch messages between two users
router.get('/:userId', auth, async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    try {
        const messages = await Message.find({
            $or: [
                { sender: currentUserId, receiver: userId },
                { sender: userId, receiver: currentUserId },
            ],
        }).sort({ timestamp: 1 });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

module.exports = router;