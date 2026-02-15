const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // user = new User({ firstname, lastname, email, password });
    // await user.save();

    // const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    // res.status(201).json({ 
    //   token, 
    //   user: { 
    //     id: user._id, 
    //     firstname, 
    //     lastname, 
    //     email,
    //     preferredCurrency: user.preferredCurrency,
    //     preferredCurrencySymbol: user.preferredCurrencySymbol,
    //     preferredLanguage: user.preferredLanguage
    //   } 
    // });
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');

    user = new User({ 
      firstname, 
      lastname, 
      email, 
      password,
      verificationToken
    });

    await user.save();

    // Create verification URL
    const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email/${verificationToken}`;
    const frontendVerifyUrl = `http://localhost:5173/verify-email/${verificationToken}`; // Assuming frontend runs on 5173

    const message = `You are receiving this email because you (or someone else) has requested the creation of an account. Please click on the following link, or paste this into your browser to complete the process: \n\n ${frontendVerifyUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Account Verification',
        message
      });

      res.status(201).json({ 
        message: 'Registration successful! Please check your email to verify your account.' 
      });
    } catch (err) {
      console.error('Email send error:', err);
      // user.verificationToken = undefined; // Optional: revert if email fails
      // await user.save();
      // But we probably want to keep the user created
      res.status(201).json({ 
        message: 'Registration successful, but failed to send verification email. Please contact support.' 
      });
    }

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Verify Email
router.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ 
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    console.error('Verification Error:', err);
    res.status(500).json({ message: 'Server error' });
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

    if (!user.isVerified) {
       return res.status(401).json({ message: 'Please verify your email to login' });
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

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    // For simplicity we might just store plain token or hash it. 
    // Let's store plain for now as per schema or hash provided in many tutorials.
    // Ideally we hash it in DB.
    // user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Token',
        message
      });

      res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
      console.log(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();

      return res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset Password
router.put('/reset-password/:resetToken', async (req, res) => {
  try {
    // Get hashed token
    // const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');
    const resetPasswordToken = req.params.resetToken;

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Automatically login? Or just ask to login.
    res.status(200).json({
      success: true,
      data: 'Password reset successful',
    });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
