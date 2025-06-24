const prisma = require('../prisma/client');

// 날짜 문자열 → BigInt(UNIX ms) 변환 함수
function toDeadlineBigInt(deadLine) {
  if (typeof deadLine === 'string' && isNaN(deadLine)) {
    // ISO 날짜 문자열일 경우
    return BigInt(new Date(deadLine).getTime());
  }
  // 숫자 또는 BigInt로 이미 들어온 경우
  return BigInt(deadLine);
}

class AssignmentModel {
  static async getLecturesAndStudents() {
    try {
      const lectures = await prisma.lecture.findMany();
      const students = await prisma.student.findMany({
        select: {
          student_id: true,
          name: true,
          bojid: true,
          learn: {
            select: {
              lecture_id: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      });

      const maskedStudents = students.map(student => ({
        ...student,
        name: student.name[0] + '**',
        lecture_id: student.learn[0]?.lecture_id || null
      }));

      return [lectures, maskedStudents];
    } catch (err) {
      throw err;
    }
  }

  static async getAssignmentResult(pID, lectureId, deadLine) {
    const deadlineBigInt = toDeadlineBigInt(deadLine);
    try {
      return await prisma.assignment_result.findMany({
        where: {
          assignment_result_id: Number(pID),
          lecture_id: Number(lectureId),
          deadline: deadlineBigInt
        }
      });
    } catch (err) {
      console.log('err in check assignment result:', err);
      throw err;
    }
  }

  static async saveAssignmentResult(pID, lectureId, deadLine, resultJson, isUpdate) {
    const deadlineBigInt = toDeadlineBigInt(deadLine);
    try {
      if (isUpdate) {
        return await prisma.assignment_result.updateMany({
          where: {
            assignment_result_id: Number(pID),
            lecture_id: Number(lectureId),
            deadline: deadlineBigInt
          },
          data: {
            result: resultJson
          }
        });
      } else {
        return await prisma.assignment_result.create({
          data: {
            assignment_result_id: Number(pID),
            result: resultJson,
            lecture_id: Number(lectureId),
            deadline: deadlineBigInt
          }
        });
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = AssignmentModel;
