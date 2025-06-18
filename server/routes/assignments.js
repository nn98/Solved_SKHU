const express = require('express');
const router = express.Router();
const controller = require('../controllers/assignmentsController');

router.get('/', controller.getAssignments);
router.post('/', controller.postAssignments);

module.exports = router;
