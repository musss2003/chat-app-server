const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middlewares/auth');

// Fetch all unique chat participants for the authenticated user
// Fetch the last messages sent or received to or from different users for the authenticated user
router.get('/chats', auth, async (req, res) => {
    try {
        const userId = req.user._id;

        const messages = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { receiver: userId }]
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$sender", userId] },
                            "$receiver",
                            "$sender"
                        ]
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                $replaceRoot: { newRoot: "$lastMessage" }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'senderDetails'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'receiver',
                    foreignField: '_id',
                    as: 'receiverDetails'
                }
            },
            {
                $unwind: "$senderDetails"
            },
            {
                $unwind: "$receiverDetails"
            },
            {
                $project: {
                    content: 1,
                    timestamp: 1,
                    sender: {
                        _id: "$senderDetails._id",
                        username: "$senderDetails.username"
                    },
                    receiver: {
                        _id: "$receiverDetails._id",
                        username: "$receiverDetails.username"
                    }
                }
            },
            {
                $sort: { timestamp: -1 } // Sort by timestamp in descending order
            }
        ]);

        console.log(messages);

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching chats' });
    }
});

module.exports = router;


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