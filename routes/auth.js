const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({ firstname, lastname, email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        firstname, 
        lastname, 
        email,
        preferredCurrency: user.preferredCurrency,
        preferredCurrencySymbol: user.preferredCurrencySymbol,
        preferredLanguage: user.preferredLanguage
      } 
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        firstname: user.firstname, 
        lastname: user.lastname, 
        email,
        preferredCurrency: user.preferredCurrency,
        preferredCurrencySymbol: user.preferredCurrencySymbol,
        preferredLanguage: user.preferredLanguage
      } 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update preferences
const auth = require('../middleware/auth');
router.put('/preferences', auth, async (req, res) => {
  try {
    const { preferredCurrency, preferredCurrencySymbol, preferredLanguage } = req.body;
    
    // Validate inputs or provide defaults
    const updateData = {};
    if (preferredCurrency) updateData.preferredCurrency = preferredCurrency;
    if (preferredCurrencySymbol) updateData.preferredCurrencySymbol = preferredCurrencySymbol;
    if (preferredLanguage) updateData.preferredLanguage = preferredLanguage;

    const user = await User.findByIdAndUpdate(
      req.user,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      preferredCurrency: user.preferredCurrency, 
      preferredCurrencySymbol: user.preferredCurrencySymbol,
      preferredLanguage: user.preferredLanguage
    });
  } catch (err) {
    console.error('Update Preferences Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
