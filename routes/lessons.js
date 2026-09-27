const express = require('express');
const router = express.Router();
const { submitLesson, matchLesson, listLessons } = require('../controllers/lessonsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/submit', submitLesson);
router.post('/match', matchLesson);
router.get('/', listLessons);

module.exports = router;
