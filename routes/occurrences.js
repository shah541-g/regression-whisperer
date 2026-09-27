const express = require('express');
const router = express.Router();
const {
  logOccurrence,
  listOccurrences,
  getStats,
  resolveOccurrence,
} = require('../controllers/occurrencesController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/log', logOccurrence);
router.get('/stats', getStats);          // must be before /:id to avoid route shadowing
router.get('/', listOccurrences);
router.patch('/:id/resolve', resolveOccurrence);

module.exports = router;
