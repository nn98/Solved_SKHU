// routes/assignments.js
const express = require('express');
const router = express.Router();
const AssignmentsController = require('../controllers/assignmentsController');

router.get('/', AssignmentsController.getAssignments);
router.post('/', AssignmentsController.postAssignments);

module.exports = router;
