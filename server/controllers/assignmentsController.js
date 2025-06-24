const humps = require('humps');
const model = require('../models/assignmentsModel');
const { crawlAssignmentStatus } = require('../service/crawlers/default');

function camelizeResponse(data) {
  return humps.camelizeKeys(data);
}

// 날짜 문자열 → BigInt(UNIX ms) 변환 함수
function toDeadlineBigInt(deadLine) {
  if (typeof deadLine === 'string' && isNaN(deadLine)) {
    // ISO 날짜 문자열일 경우
    return BigInt(new Date(deadLine).getTime());
  }
  // 숫자 또는 BigInt로 이미 들어온 경우
  return BigInt(deadLine);
}

class AssignmentsController {
  static async getAssignments(req, res) {
    try {
      const [lectures, students] = await model.getLecturesAndStudents();

      const responseData = {
        result: [
          lectures.map(lecture => camelizeResponse(lecture)),
          students.map(student => camelizeResponse(student))
        ],
        processing: false,
        called: 0
      };

      res.json(responseData);
    } catch (err) {
      res.status(500).json({ error: 'DB Error', detail: err.message });
    }
  }

  static async postAssignments(req, res) {
    try {
      const { PID: pID, ID_LIST, DeadLine: deadLine, reAssignment } = req.body;
      const lectureId = ID_LIST[0].lectureId;
      // deadLine을 BigInt(UNIX ms)로 변환
      const deadlineBigInt = toDeadlineBigInt(deadLine);

      const dbResult = await model.getAssignmentResult(
        pID,
        lectureId,
        deadlineBigInt
      );
      console.log('dbResult', dbResult);
      if (dbResult.length > 0) {
        console.log('dbResult[0].result',dbResult[0].result);
        console.log('dbResult[0].result.status',dbResult[0].result.status);
      }

      let assignmentResult = [];
      if (!reAssignment && dbResult.length > 0) {
        assignmentResult = JSON.parse(dbResult[0].result).map(item =>
          camelizeResponse(item)
        );
      } else {
        const crawledData = await crawlAssignmentStatus(ID_LIST, pID, deadlineBigInt);
        assignmentResult = crawledData.result.map(item => camelizeResponse(item));

        await model.saveAssignmentResult(
          pID,
          lectureId,
          deadlineBigInt,
          JSON.stringify(humps.decamelizeKeys(assignmentResult)),
          !!reAssignment && dbResult.length > 0
        );
      }

      res.json({
        result: assignmentResult,
        processing: false
      });
    } catch (err) {
      console.log('error', err);
      res.status(500).json({
        error: 'Server Error',
        detail: humps.camelizeKeys(err)
      });
    }
  }
}

module.exports = AssignmentsController;
