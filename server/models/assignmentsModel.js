const connection = require('../db/connection');

exports.getLecturesAndStudents = () => {
  const sql = `
    SELECT * FROM lecture;
    SELECT s.student_id AS student_id, REPLACE(name, SUBSTRING(name,2),'**') AS name, bojid, lecture_id
    FROM student AS s JOIN learn AS l ON s.student_id = l.student_id ORDER BY name;
  `;
  return new Promise((resolve, reject) => {
    connection.query(sql, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

exports.getAssignmentResult = (pID, lectureId, deadLine) => {
  const sql = `SELECT * FROM assignment_result WHERE assignment_result_id=? AND lecture_id=? AND deadline=?;`;
  return new Promise((resolve, reject) => {
    connection.query(sql, [pID, lectureId, deadLine], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

exports.saveAssignmentResult = (pID, lectureId, deadLine, resultJson, isUpdate) => {
  let sql, params;
  if (isUpdate) {
    sql = `UPDATE assignment_result SET result=? WHERE assignment_result_id=? AND lecture_id=? AND deadline=?;`;
    params = [resultJson, pID, lectureId, deadLine];
  } else {
    sql = `INSERT INTO assignment_result (assignment_result_id, result, lecture_id, deadline) VALUES (?, ?, ?, ?);`;
    params = [pID, resultJson, lectureId, deadLine];
  }
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
