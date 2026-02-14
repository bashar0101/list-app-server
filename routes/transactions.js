const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// Get transactions for a specific list
router.get('/:listId', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ 
      list: req.params.listId, 
      user: req.user 
    }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a transaction
router.post('/', auth, async (req, res) => {
  try {
    const { description, amount, type, listId, currency, currencySymbol } = req.body;
    const newTransaction = new Transaction({
      description,
      amount,
      type,
      currency: currency || 'USD',
      currencySymbol: currencySymbol || '$',
      list: listId,
      user: req.user
    });
    const transaction = await newTransaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a transaction
router.put('/:id', auth, async (req, res) => {
  try {
    const { description, amount, type } = req.body;
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user },
      { description, amount, type },
      { returnDocument: 'after', runValidators: true }
    );
    
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete a transaction

module.exports = router;
