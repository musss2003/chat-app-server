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
    const { userId, chatId } = req.body;

    try {
        await Message.updateMany(
            { sender: chatId, receiver: userId, read: false },
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

        console.log('Fetching chats for user', userId);

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

// Send a new message
router.post('/send', auth, async (req, res) => {
    try {
        const { receiver, content } = req.body;
        const sender = req.user._id;
        
        const newMessage = new Message({
            sender,
            receiver,
            content,
            timestamp: new Date(),
            read: false
        });

        await newMessage.save();

        // Emit the message to both the sender and receiver's rooms
        io.to(sender.toString()).emit('receiveMessage', newMessage);
        io.to(receiver.toString()).emit('receiveMessage', newMessage);

        // Update chat list for both participants
        await updateChatListData(sender, receiver, newMessage);

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message' });
    }
});

module.exports = router;