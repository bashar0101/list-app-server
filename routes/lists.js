const express = require('express');
const router = express.Router();
const List = require('../models/List');
const auth = require('../middleware/auth');

// Get all lists for logged in user
router.get('/', auth, async (req, res) => {
  try {
    const lists = await List.find({ user: req.user }).sort({ createdAt: -1 });
    res.json(lists);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new list
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const newList = new List({ name, user: req.user });
    const list = await newList.save();
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a list
router.delete('/:id', auth, async (req, res) => {
  try {
    const list = await List.findOne({ _id: req.params.id, user: req.user });
    if (!list) return res.status(404).json({ message: 'List not found' });
    
    await list.deleteOne();
    res.json({ message: 'List removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
