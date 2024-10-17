const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middlewares/auth');

// Fetch all unique chat participants for the authenticated user
router.get('/chats', async (req, res) => {
    try {
        const userId = req.query.userId;

        // Find all unique chat participants
        const sentMessages = await Message.find({ sender: userId }).distinct('receiver');
        const receivedMessages = await Message.find({ receiver: userId }).distinct('sender');

        const uniqueChatParticipants = [...new Set([...sentMessages, ...receivedMessages])];

        res.json(uniqueChatParticipants);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching chats' });
    }
});


// Fetch chat history between authenticated user and another user
router.get('/:receiverId', auth, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user._id, receiver: req.params.receiverId },
                { sender: req.params.receiverId, receiver: req.user._id },
            ],
        }).sort('timestamp');
        res.json(messages);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Send a message
router.post('/send', auth, async (req, res) => {

    const { content, receiver } = req.body;
    const sender = req.user._id;

    try {
        const newMessage = new Message({ content, sender, receiver });
        const savedMessage = await newMessage.save();
        res.status(201).json(savedMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message' });
    }
});

module.exports = router;