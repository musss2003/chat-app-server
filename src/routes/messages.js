const express = require('express');
const Message = require('../models/Message');
const auth = require('../middlewares/auth');
const router = express.Router();

// Send a message
router.post('/', auth, async (req, res) => {
    const { content, receiver } = req.body;

    const sender = req.user._id;

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

// Get messages between two users
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


module.exports = router;