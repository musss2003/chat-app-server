const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middlewares/auth');

const getLastMessages = async (userId) => {
    return await Message.aggregate([
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
                lastMessage: { $first: "$$ROOT" },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ["$receiver", userId] }, { $eq: ["$read", false] }] },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $replaceRoot: { newRoot: { lastMessage: "$lastMessage", unreadCount: "$unreadCount" } }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'lastMessage.sender',
                foreignField: '_id',
                as: 'senderDetails'
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'lastMessage.receiver',
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
                content: "$lastMessage.content",
                timestamp: "$lastMessage.timestamp",
                unreadCount: 1,
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
}


// Endpoint to mark messages as read
router.post('/markAsRead', async (req, res) => {
    const { userId, selectedUserId } = req.body;

    try {
        await Message.updateMany(
            { sender: selectedUserId, receiver: userId, read: false },
            { $set: { read: true } }
        );
        res.status(200).send({ message: 'Messages marked as read' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to mark messages as read' });
    }
});


// Fetch the last messages sent or received to or from different users for the authenticated user
router.get('/chats', auth, async (req, res) => {
    try {
        const userId = req.user._id;

        const messages = await getLastMessages(userId);

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching chats' });
    }
});

// Fetch chat history between authenticated user and another user
router.get('/:selectedUserId', auth, async (req, res) => {

    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user._id, receiver: req.params.selectedUserId },
                { sender: req.params.selectedUserId, receiver: req.user._id },
            ],
        }).sort('timestamp');

        res.json(messages);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

module.exports = router;