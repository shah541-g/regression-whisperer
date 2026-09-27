const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Company = require('../models/Company');

const SALT_ROUNDS = 10;

function signToken(companyId) {
  return jwt.sign({ companyId }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

function safeCompany(company) {
  const obj = company.toObject();
  delete obj.passwordHash;
  return obj;
}

// POST /api/auth/signup
const signup = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const company = await Company.create({ name, email, passwordHash });
    const token = signToken(company._id);
    return res.status(201).json({ token, company: safeCompany(company) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return res.status(500).json({ error: `Signup failed: ${err.message}` });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, company.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(company._id);
    return res.status(200).json({ token, company: safeCompany(company) });
  } catch (err) {
    return res.status(500).json({ error: `Login failed: ${err.message}` });
  }
};

// GET /api/auth/me  (protected)
const me = async (req, res) => {
  try {
    const company = await Company.findById(req.company.companyId).select('-passwordHash');
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    return res.status(200).json({ company });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch company: ${err.message}` });
  }
};

module.exports = { signup, login, me };
