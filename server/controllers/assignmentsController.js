const model = require('../models/assignmentsModel');
const { crawlAssignmentStatus } = require('../service/crawler');

exports.getAssignments = async (req, res) => {
  try {
    const result = await model.getLecturesAndStudents();
    res.json({ result, processing: false, called: 0 });
  } catch (err) {
    res.status(500).json({ error: 'DB Error', detail: err });
  }
};

exports.postAssignments = async (req, res) => {
  let { PID: pID, ID_LIST, DeadLine: deadLine, reAssignment } = req.body;
  let lectureId = ID_LIST[0].Lecture_ID;
  // deadLine 파싱 및 timestamp 변환 생략
  let result = await model.getAssignmentResult(pID, lectureId, deadLine);
  let assignment_Result = [];
  if (!reAssignment && result.length > 0) {
    assignment_Result = JSON.parse(result[0].result);
  } else {
    assignment_Result = await crawlAssignmentStatus(ID_LIST, pID, deadLine);
    await model.saveAssignmentResult(
      pID,
      lectureId,
      deadLine,
      JSON.stringify(assignment_Result),
      !!reAssignment && result.length > 0
    );
  }
  res.json({ result: assignment_Result, processing: false });
};
