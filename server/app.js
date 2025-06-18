const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const WaitNotify = require('wait-notify');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
require('dotenv').config();
process.setMaxListeners(50);
BigInt.prototype.toJSON = function () { return this.toString(); };

const app = express();
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({extended: false}));

const connection = require('./config/dbConnection');
connection.getConnection((err, conn) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
    conn.release();
});
app.use((req, res, next) => { req.mysql = connection; next(); }); // 커넥션 풀을 req에 할당

const waitNotify_StudentRegister = new WaitNotify(); // AssignTaskExecute_StudentRegister
let AssignTaskExecute_StudentRegister = false; // - waitNotify_StudentRegister

// UserRegister - canceled _ addCorrection ?_ userUpdate ?_ solvePage ?_ correction Update
const waitNotify_UserRegister = new WaitNotify(); // AssignTaskExecute_UserRegister
let AssignTaskExecute_UserRegister = false; // - waitNotify_UserRegister

app.get('/', (req, res) => { res.send('working?'); });

const algorithmRouter = require('./routes/algorithm');
app.use('/algorithm', algorithmRouter);

const problemRouter = require('./routes/problem');
app.use('/problem', problemRouter);

const userPageRouter = require('./routes/userPage')
app.use('/userPage', userPageRouter);

const qnaRouter = require('./routes/qna');
app.use('/QnA', qnaRouter);

const ratingRouter = require('./routes/rating');
app.use('/rating', ratingRouter);

const rankingRouter = require('./routes/ranking');
app.use('/ranking', rankingRouter);

const registerRouter = require('./routes/register');
app.use('/register', registerRouter); // 모든 등록 관련 경로는 /register 하위로

const assignmentsRouter = require('./routes/assignments');
app.use('/assignments', assignmentsRouter);

/* --------------- Register Part - Professor --------------- */
app.post('/proRegister', (req, res) => {
    console.log('proRegister/post ', 'is called');
    // console.log(req);
    const b = req.body;
    // console.log(b);
    if ((b.pC === 'proskhuOp12#') | (b.pC === 'S')) {
        for (let i = 0; i < b.cN; i++) {
            const sql =
                'insert into lecture (professor, code, name, distribution) values(' +
                "'" +
                b.pN +
                "', " +
                "'" +
                b.sC +
                "', " +
                "'" +
                b.sN +
                (b.cN < 2 ? '' : '-0' + (i + 1)) +
                "', " +
                (i + 1) +
                ');';
            console.log(sql);
            connection.query(sql, function (err, result, fields) {
                if (err) {
                    res.status(406).json('에러가 발생했습니다. 입력 내용을 확인해주세요.');
                }
            });
        }
        res.status(200).json('강의 등록이 완료되었습니다.');
    } else {
        res.status(406).json('교수 승인코드가 틀렸습니다.');
    }
});
/* --------------- Register Part - Professor / Register Part - Student --------------- */
app.get('/studentRegister', (req, res) => {
    console.log('studentRegister/get ', 'is called');
    const b = req.body;
    console.log('body', b);
    res.send(b);
});

app.post('/studentRegister', async (req, res) => {
    console.log('studentRegister/post ', 'is called');
    const b = req.body;
    let end = false;
    console.log('body', b);
    if ((b.sC === 'stuSK#') | (b.sC === 'S')) {
        console.log('Student code is correct');
        let sql =
            'insert into student (student_id, name, bojid) values(' +
            Number(b.sI) +
            ', ' +
            "'" +
            b.sN +
            "', " +
            "'" +
            b.bI +
            "');";
        console.log('학생 등록 쿼리 시작', sql);
        AssignTaskExecute_StudentRegister = true;
        connection.query(sql, async function (err, result, fields) {
            console.log('학생 테이블 존재 여부 확인');
            if (err) {
                console.log('res', '쿼리 실행이 실패했습니다. 해당 학생이 이미 존재합니다.');
                AssignTaskExecute_StudentRegister = false;
                waitNotify_StudentRegister.notify();
            } else {
                console.log('res', '쿼리 실행이 성공했습니다. 신규 학생입니다.');
            }
            AssignTaskExecute_StudentRegister = false;
            waitNotify_StudentRegister.notify();
        });
        if (AssignTaskExecute_StudentRegister) await waitNotify_StudentRegister.wait();

        console.log('존재 여부 확인 완료.');
        AssignTaskExecute_StudentRegister = true;
        sql = 'insert into learn values(' + Number(b.sI) + ',' + b.lI + ');';
        console.log('수강 등록 쿼리', sql);
        connection.query(sql, async function (err, result, fields) {
            console.log('수강 등록');
            if (err) {
                console.log('res', '쿼리 실행이 실패했습니다.');
                res.status(406).json('에러가 발생했습니다. 이미 수강중인 학생입니다.');
                end = true;
                return;
            } else {
                console.log('res', '쿼리 실행이 성공했습니다.');
            }
            AssignTaskExecute_StudentRegister = false;
            waitNotify_StudentRegister.notify();
        });
        if (AssignTaskExecute_StudentRegister) await waitNotify_StudentRegister.wait();
        if (end) return;
        res.status(200).json('학생 등록이 완료되었습니다.');
    } else {
        console.log('Student code isnt correct');
        console.log('res', '학생 승인코드가 틀렸습니다.');
        res.status(406).json('학생 승인코드가 틀렸습니다.');
    }
});
/* --------------- Register Part - Student --------------- */

/* --------------- UserRegister --------------- */
app.post('/register', async (req, res) => {
    const url = 'https://solved.ac/ranking/o/309';
    const b = req.body;
    let errOcc = false;
    console.log(b);
    let resul = [];
    let ti;
    console.log('check student code');
    if (b.rC !== 'stuSK#') {
        res.status(406).json('학생 승인코드가 틀렸습니다.');
        return;
    }
    AssignTaskExecute_UserRegister = true;
    console.log('solved check success');
    let sqls = 'select * from user where user_id = "' + b.ui + '"';
    console.log('run conntion', sqls);

    if (errOcc) return;

    connection.query(sqls, async function (err, result, fields) {
        console.log(result.length === 0);
        if (result.length === 0) {
            console.log('User 데이터베이스에 해당 학생 없음. 등록 가능');
        } else {
            console.log('send response', '에러가 발생했습니다. 이미 존재하는 학생입니다.');
            res.status(406).json('에러가 발생했습니다. 이미 존재하는 학생입니다.');
            AssignTaskExecute_UserRegister = false;
            waitNotify_UserRegister.notify();
            errOcc = true;
        }
    });
    addRegister(b.uI, url);
    if (AssignTaskExecute_UserRegister) await waitNotify_UserRegister.wait();
    console.log(errOcc);
    if (errOcc) return;

    // 입력받은 유저를 랭킹테이블(데이터베이스)에 추가하는 함수
    async function addRegister(pID, url) {
        puppeteer
            .launch({headless: true})
            .then(async browser => {
                const page = await browser.newPage();

                await page.goto(url, {waitUntil: 'networkidle2'});
                const content = await page.content();
                const $ = cheerio.load(content);
                const lists = $('tr');

                let name = [];
                let c = [];
                let d = [];

                lists.each((index, list) => {
                    name = $(list).find('td').toString();
                    if (name.includes(b.uI) === true) {
                        c = name;
                        d = c.split('</td>');
                    }
                });
                ti = $(c).find('img').toString();

                for (let e = 0; e < d.length; e++) {
                    resul[e] = d[e].replace(/(<([^>]+)>)|&nbsp;/gi, '');
                }
                if (resul.length === 0) {
                    errOcc = true;
                    console.log('err in solved.ac');
                    AssignTaskExecute_UserRegister = false;
                    waitNotify_UserRegister.notify();
                    res.status(406).json('Solved.ac에서 해당 ID를 찾을 수 없습니다. 등록 후 시도해주세요');
                    return;
                }
                console.log(resul);
                console.log('suc in solved.ac');
                AssignTaskExecute_UserRegister = false;
                waitNotify_UserRegister.notify();
            })
            .catch(error => {
                errOcc = true;
                console.log('err in solved.ac', error);
                AssignTaskExecute_UserRegister = false;
                waitNotify_UserRegister.notify();
                res.status(406).json('솔브드에서 응답하지 않습니다. 잠시후 다시 시도해주세요');
            });
    }

    let name2 = [];
    let pages = 1;
    let d2 = [];
    let resul2 = [];

    // 입력받은 유저의 정답률을 크롤링하는 함수
    async function addCorrection(pID, url) {
        console.log('addCorrection is run_to:', url);

        puppeteer
            .launch({headless: true})
            .then(async browser => {
                const page = await browser.newPage();

                await page.goto(url, {waitUntil: 'networkidle2'});
                const content = await page.content();
                // $에 cheerio를 로드한다.
                const $ = cheerio.load(content);
                // 복사한 리스트의 Selector로 리스트를 모두 가져온다.
                const lists2 = $('tr');
                // 모든 리스트를 순환한다.
                let c2 = [];
                lists2.each((index, list) => {
                    name2 = $(list).find('td').toString();
                    if (name2.includes(b.uI) === true) {
                        c2 = name2;
                        d2 = c2.split('</td>');
                    }
                });
                console.log(pages);
                // console.log(c2===undefined)
                for (let e = 0; e < d2.length; e++) {
                    resul2[e] = d2[e].replace(/(<([^>]+)>)|&nbsp;/gi, '');
                    console.log(resul2[e]);
                }

                AssignTaskExecute_UserRegister = false;
                waitNotify_UserRegister.notify();
            })

            .catch(error => {
                console.log(error);
                AssignTaskExecute_UserRegister = false;
                waitNotify_UserRegister.notify();
            });
    }

    // 전체랭킹 / 학교랭킹 / ID / 레이팅 / 클래스 / 푼 문제 수 / 티어 / 정답률 / 백준ID
    let worldrank, skhurank, userid, rating, classs, problems, tier, corr, bojid;
    worldrank = resul[0];
    skhurank = resul[1];
    userid = resul[2];
    rating = resul[3];
    classs = resul[4];
    problems = resul[5];
    bojid = b.gI;
    tier = ti.split('<img src="https://static.solved.ac/tier_small/')[1].split('.svg"')[0];
    console.log(
        worldrank +
        ' ' +
        skhurank +
        ' ' +
        userid +
        ' ' +
        rating +
        ' ' +
        classs +
        ' ' +
        problems +
        ' ' +
        bojid +
        ' ' +
        tier
    );
    corr = undefined;
    while (corr === undefined) {
        AssignTaskExecute_UserRegister = true;
        addCorrection(b.uI, 'https://www.acmicpc.net/school/ranklist/309/' + pages);
        if (AssignTaskExecute_UserRegister) await waitNotify_UserRegister.wait();
        corr = resul2[resul2.length - 2];
        console.log('corr:', corr);
        pages++;
    }
    console.log(
        userid +
        '",' +
        problems +
        ',' +
        tier +
        ',"' +
        worldrank +
        '",' +
        skhurank +
        ',' +
        rating +
        ',"' +
        classs +
        '","' +
        corr
    );
    const sql =
        'insert into user values("' +
        userid +
        '",' +
        problems +
        ',' +
        tier +
        ',"' +
        worldrank +
        '",' +
        skhurank +
        ',' +
        rating +
        ',"' +
        classs +
        '","' +
        corr +
        '","' +
        bojid +
        '");';
    console.log(sql);
    // 등록할 학생을 DB에 넣는 과정
    connection.query(sql, async function (err, result, fields) {
        if (err) {
            console.log('err in insert', err);
            res.status(406).json('error');
        }
        res.status(200).json('학생 등록이 완료되었습니다. 새로고침 후 이용해주시기 바랍니다.');
    });
    AssignTaskExecute_UserRegister = true;
    userUpdate(url, req);
    let updateP = 1;
    while (updateP <= 3) {
        AssignTaskExecute_UserRegister = true;
        correctionUpdate('https://www.acmicpc.net/school/ranklist/309/' + updateP);
        if (AssignTaskExecute_UserRegister) await waitNotify_UserRegister.wait();
        updateP++;
    }
});

// 전체 학생 정보 업데이트 함수
async function userUpdate(url, req) {
    puppeteer
        .launch({headless: true})
        .then(async browser => {
            const page = await browser.newPage();

            await page.goto(url, {waitUntil: 'networkidle2'});
            const content = await page.content();
            // $에 cheerio를 로드한다.
            const $ = cheerio.load(content);
            // 복사한 리스트의 Selector로 리스트를 모두 가져온다.
            const lists3 = $('tr');
            // 모든 리스트를 순환한다.
            let c3 = [];
            let d3 = [];
            let name3 = [];
            let resul3 = [];
            let tiee;
            let worldrank, skhurank, userid, rating, classs, problems, tie, bojid;
            lists3.each((index, lists) => {
                if (index > 0) {
                    name3 = $(lists).find('td').toString();
                    c3 = name3;
                    d3 = c3.split('</td>');
                    tiee = $(c3).find('img').toString();
                    // console.log(tiee[index].split('.svg"')[0].replace(/[^0-9]/gi,""))
                    for (let e = 0; e < d3.length; e++) {
                        resul3[e] = d3[e].replace(/(<([^>]+)>)|&nbsp;/gi, '');
                    }
                    worldrank = resul3[0];
                    skhurank = resul3[1];
                    userid = resul3[2];
                    rating = resul3[3];
                    classs = resul3[4];
                    problems = resul3[5].replace(',', '');
                    tie = tiee.split('.svg"')[0].replace(/[^0-9]/gi, '');
                    // console.log(ti);
                    bojid = req.body.gI;
                    // console.log('worldrank : ',worldrank,'skhurank : ', skhurank,'userid : ', userid,'rating : ', rating,'class : ' ,classs,'problems : ', problems,'tier : ' ,tie,'bojid : ', bojid);
                    const sql =
                        'update user set problems = ' +
                        problems +
                        ', solvedrank = ' +
                        tie +
                        ',worldrank="' +
                        worldrank +
                        '",skhurank=' +
                        skhurank +
                        ',rating=' +
                        rating +
                        ',class="' +
                        classs +
                        '",gitid = "' +
                        bojid +
                        '" where user_id = "' +
                        userid +
                        '";';
                    console.log(sql);
                    connection.query(sql, async function (err, result, fields) {
                        if (err) {
                            console.log('err in update', err);
                        }
                    });
                }
                console.log();
            });
            solvePage('https://solved.ac/profile/' + req.body.uI + '/solved', req.body.uI);
            AssignTaskExecute_UserRegister = false;
            waitNotify_UserRegister.notify();
        })
        .catch(error => {
            console.log(error);
        });
}

async function solvePage(url, userid) {
    puppeteer
        .launch({headless: true})
        .then(async browser => {
            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(0);
            await page.goto(url, {waitUntil: 'networkidle2'});
            const content = await page.content();
            let solpage = 1;
            const $ = cheerio.load(content);
            const list5 = $('#__next > div > div.css-axxp2y > div > div:nth-child(4) > div.css-18lc7iz');
            const pages = $(list5).find('a').toString();
            let a = pages.split('</a>');
            let b = a[a.length - 2].split(/class="css-af4alp">|class="css-1orliys">/);
            console.log(b[1]);
            while (solpage <= b[1]) {
                solveProblem('https://solved.ac/profile/' + userid + '/solved?page=' + solpage++, userid);
            }

            AssignTaskExecute_UserRegister = false;
            waitNotify_UserRegister.notify();
        })

        .catch(error => {
            console.log(error);
        });
}

async function solveProblem(url, userid) {
    puppeteer
        .launch({headless: true})
        .then(async browser => {
            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(0);
            await page.goto(url, {waitUntil: 'networkidle2'});
            const content = await page.content();
            const $ = cheerio.load(content);
            const lists = $('tr');
            let c5 = [];
            let d5 = [];
            let name5 = [];
            let resul5 = [];
            lists.each((index, list) => {
                name5 = $(list).find('td').toString();
                c5 = name5;
                d5 = c5.split('</td>');
                resul5[0] = d5[0].replace(/(<([^>]+)>)|&nbsp;/gi, '');
                const sql =
                    'insert into solve(user_id, problem_id) values("' + userid + '","' + resul5[0] + '")';
                console.log(sql);
                try {
                    connection.query(sql, async function (err, result, fields) {
                        if (err) {
                            console.log('err in update', err);
                        }
                    });
                } catch (error) {
                    console.log(error);
                }
            });
            AssignTaskExecute_UserRegister = false;
            waitNotify_UserRegister.notify();
        })

        .catch(error => {
            console.log(error);
        });
}

async function correctionUpdate(url) {
    puppeteer
        .launch({headless: true})
        .then(async browser => {
            const page = await browser.newPage();

            await page.goto(url, {waitUntil: 'networkidle2'});
            const content = await page.content();
            // $에 cheerio를 로드한다.
            const $ = cheerio.load(content);
            // 복사한 리스트의 Selector로 리스트를 모두 가져온다.
            const lists4 = $('tr');
            // 모든 리스트를 순환한다.
            let c4 = [];
            let d4 = [];
            let name4 = [];
            let resul4 = [];
            let id;
            let correction;
            lists4.each((index, list) => {
                name4 = $(list).find('td').toString();
                c4 = name4;
                d4 = c4.split('</td>');
                for (let e = 0; e < d4.length; e++) {
                    resul4[e] = d4[e].replace(/(<([^>]+)>)|&nbsp;/gi, '');
                }
                id = resul4[1];
                correction = resul4[resul4.length - 2];
                const sql = 'update user set correction = "' + correction + '" where user_id = "' + id + '";';
                console.log(sql);
                connection.query(sql, async function (err, result, fields) {
                    if (err) {
                        console.log('err in update', err);
                    }
                });
            });
            // console.log(pages)
            // console.log(c2===undefined)

            AssignTaskExecute_UserRegister = false;
            waitNotify_UserRegister.notify();
        })

        .catch(error => {
            console.log(error);
        });
}

/* --------------- UserRegister --------------- */

// /* --------------- Assignments Part --------------- */
//
// const waitNotify_Assignment_Individual = new WaitNotify(); // Assignment - execute, isFinish
// let AsyncTaskExecute_Assignment_Individual = [false, false];
//
// const waitNotify_Assignment_All_Task = new WaitNotify(); // AssignTaskExecute_Assignment_All_Task
// let AssignTaskExecute_Assignment_All_Task = false; // - waitNotify_Assignment_All_Task
//
// let processing = false;
// // global.processing;
// let called = 0;
// // global.called;
//
// app.get('/assignments', (req, res) => {
//     console.log('!+++++++++++++++++++', 'assignments/get ', 'is called');
//     let sql =
//         'select * from lecture;' +
//         'select s.student_id as student_id, replace(name,substring(name,2),\'**\') as name, bojid, lecture_id from student as s join learn as l on s.student_id = l.student_id order by name;';
//     console.log('get Lectures', sql);
//
//     connection.query(sql, function (err, result, fields) {
//         if (err) {
//             console.log('error in assignments-get', err);
//             throw err;
//         }
//         console.log('result is recived ... response');
//         // res.json(result);
//         res.json({result: result, processing: processing, called: called});
//     });
// });
//
// let parallelizationControl;
// let assignment_Result = [];
// let re_asyncReturn = false;
// let re_waitReturn = new WaitNotify();
// let myDate;
// let sql;
//
// app.post('/assignments', async (req, res) => {
//     console.log('!+++++++++++++++++++', 'assignments/post ', 'is called');
//     called++;
//     console.log('%%%%%processing:', processing);
//     processing = true;
//     console.log('%%%%%set processing:', processing);
//     // console.log('clean assignment_Result');
//     assignment_Result = [];
//     // console.log(req.body);
//     console.log('ID_LIST:\n', req.body.ID_LIST);
//     console.log('Problem ID:\t', req.body.PID);
//     let pID = req.body.PID;
//     let ID_LIST = req.body.ID_LIST;
//     let deadLine = req.body.DeadLine;
//     let lectureId = ID_LIST[0].Lecture_ID;
//     let reAssignment = req.body.reAssignment;
//     console.log('deadline:\t\t', deadLine);
//     myDate = deadLine.split('-');
//     console.log('deadline:\t\t', myDate);
//     let myTime = myDate[2].split('T');
//     console.log('myTime:\t\t\t', myTime);
//     let spTime = myTime[1].split(':');
//     spTime[0] = Number(spTime[0]) + 9;
//     console.log('spTime:\t\t\t', spTime);
//     var newDate = new Date(myDate[0], myDate[1] - 1, myTime[0], spTime[0]);
//     // console.log(newDate.getTime());
//     deadLine = newDate.getTime();
//     console.log('DL timestamp:\t', deadLine);
//     console.log('reAssignment:\t', reAssignment);
//     if (!reAssignment) {
//         console.log('not reAssign...');
//         console.log('#---------', '$ASYNC --- wait for checkResult, assignment_R.length:', assignment_Result.length);
//         re_asyncReturn = true;
//         checkResult(pID, lectureId, deadLine);
//         if (re_asyncReturn) await re_waitReturn.wait();
//         console.log('#---------', '$ASYNC --- checkResult is finish, assignment_R.length:', assignment_Result.length);
//     }
//
//     if ((assignment_Result.length < 1) | reAssignment) {
//         if (reAssignment) {
//             console.log('reAssign...');
//             assignment_Result = [];
//         }
//         console.log('@---------', 'execute assignment.');
//         AssignTaskExecute_Assignment_All_Task = true;
//         parallelizationControl = [
//             {AsyncTaskExecute: false, waitNotify: new WaitNotify(), fin: false},
//             {AsyncTaskExecute: false, waitNotify: new WaitNotify(), fin: false},
//         ];
//         let head_assignment_Result = [];
//         let head_ID_LIST = ID_LIST.slice(0, ID_LIST.length / 2);
//         let tail_assignment_Result = [];
//         let tail_ID_LIST = ID_LIST.slice(ID_LIST.length / 2);
//
//         // console.log('head_ID_LIST', head_ID_LIST);
//         // console.log('tail_ID_LIST', tail_ID_LIST);
//         // console.log('paral', parallelizationControl);
//         // console.log('rere at post:', assignment_Result);
//
//         if (head_ID_LIST.length > 0) run(head_ID_LIST, pID, deadLine, head_assignment_Result, 0);
//         if (tail_ID_LIST.length > 0) run(tail_ID_LIST, pID, deadLine, tail_assignment_Result, 1);
//         if (AssignTaskExecute_Assignment_All_Task) await waitNotify_Assignment_All_Task.wait();
//
//         // console.log('re_head:', head_assignment_Result);
//         // console.log('re_tail:', tail_assignment_Result);
//
//         assignment_Result.push(...head_assignment_Result);
//         assignment_Result.push(...tail_assignment_Result);
//
//         // assignment_Result=head_assignment_Result.concat(tail_assignment_Result);
//         // console.log("Result-json:",JSON.stringify(assignment_Result));
//
//         // re_asyncReturn = true;
//         let isAssigned = false;
//
//         console.log('$$$$$isAssigned?');
//
//         re_asyncReturn = true;
//
//         sql =
//             'select * from assignment_result where' +
//             ' assignment_result_id=' + pID +
//             ' and lecture_id=' + lectureId +
//             ' and deadline=' + deadLine +
//             ";";
//
//         try {
//             connection.query(sql, async function (err, result, fields) {
//                 if (err) {
//                     console.log('!#--------err in isAssigned', err);
//                     re_asyncReturn = false;
//                     re_waitReturn.notify();
//
//                 } else {
//                     console.log('!#--------isAssigned! length:', result.length);
//                     if (result.length > 0) isAssigned = true;
//                     re_asyncReturn = false;
//                     re_waitReturn.notify();
//
//                 }
//             });
//         } catch (error) {
//             console.log('!#--------err in isAssigned', error);
//             re_asyncReturn = false;
//             re_waitReturn.notify();
//
//         }
//
//         if (re_asyncReturn) await re_waitReturn.wait();
//
//         console.log('#--------- save result...');
//         if (reAssignment & isAssigned) {
//             sql = 'update assignment_result set' +
//                 " result='" + JSON.stringify(assignment_Result) +
//                 "' where" +
//                 ' assignment_result_id=' + pID +
//                 ' and lectureid="' + lectureId +
//                 '" and deadline=' + deadLine +
//                 ";";
//         } else {
//             console.log('without result:', ('insert into assignment_result (assignment_result_id,lecture_id,deadline) values(' +
//                 pID +
//                 ",'" +
//                 lectureId +
//                 "'," +
//                 deadLine +
//                 ");"));
//             sql =
//                 'insert into assignment_result (assignment_result_id,result,lecture_id,deadline) values(' +
//                 pID +
//                 ",'" +
//                 JSON.stringify(assignment_Result) +
//                 "'," +
//                 lectureId +
//                 "," +
//                 deadLine +
//                 ");";
//
//         }
//
//         console.log('$$$$$sql:', sql);
//
//         try {
//             connection.query(sql, async function (err, result, fields) {
//                 if (err) {
//                     console.log('!#--------err in update', err);
//                 } else {
//                     console.log('!#--------save success!');
//                 }
//             });
//         } catch (error) {
//             console.log('!#--------err in update', error);
//         }
//     }
//
//     console.log('%%%%%wait for return - processing:', processing);
//     if (re_asyncReturn) await re_waitReturn.wait();
//     // console.log('send response: ', assignment_Result);
//     // ID_LIST=assignment_Result;
//     processing = false;
//     // res.send(assignment_Result);
//     console.log('%%%%%return - processing:', processing);
//     res.json({result: assignment_Result, processing: processing});
// });
//
// let urls = [
//     'https://www.acmicpc.net/status?problem_id=',
//     '&user_id=',
//     '&language_id=-1&result_id=-1',
// ];
//
// async function run(ID_LIST, pID, deadLine, assignment_Result, flag) {
//     console.log('----------', 'paral:', flag, '1. run');
//     // console.log("1. run", assignment_Result);
//     // console.log("ID_LIST", ID_LIST);
//     console.log('----------', 'paral:', flag, 'pID', pID);
//     let processID = ID_LIST[0].bojid;
//     let url = urls[0] + pID + urls[1] + processID + urls[2];
//     // console.log("rere at run:", assignment_Result);
//     execute(ID_LIST, pID, deadLine, processID, url, assignment_Result, flag);
// }
//
// async function execute(ID_LIST, pID, deadLine, processID, url, assignment_Result, flag) {
//     console.log('----------', 'paral:', flag, '2. execute');
//     // console.log("rere at execute:", assignment_Result);
//     puppeteer
//         .launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']})
//         .then(async browser => {
//             if (parallelizationControl[flag].AsyncTaskExecute) {
//                 await parallelizationControl[flag].waitNotify.wait();
//             }
//
//             console.log('----------', 'paral:', flag, 'now process\t', processID);
//             parallelizationControl[flag].AsyncTaskExecute = true;
//             const page = await browser.newPage();
//             await page.setDefaultNavigationTimeout(0);
//             await page.goto(url, {waitUntil: 'networkidle2', timeout: 0});
//
//             const content = await page.content();
//             const $ = cheerio.load(content);
//             let re = [];
//             const lists = $('tr');
//
//             // console.log(lists);
//
//             let returnData = [];
//             let ac = 0;
//             if (lists.length > 1) {
//                 lists.each((index, list) => {
//                     let red = [];
//                     let lac = 0;
//                     let ldate;
//                     let rdate;
//
//                     // const name = $(list).find('td').toString();
//                     // console.log('name', name);
//
//                     const name0 = $(list).find('td').toString().split('<td>');
//
//                     // !===== #84 check deadLine console.log('name0', name0);
//                     // !===== #84 check deadLine for (let i = 0; ++i < name0.length; console.log(i, name0[i]));
//
//                     for (let i = 0; ++i < name0.length;) {
//                         // console.log("N", i, name0[i]);
//                         if (name0[i].split('</td>').length > 3) {
//                             let v = name0[i].split('</td>');
//
//                             // !===== #84 check deadLine console.log('case 1:', v);
//
//                             for (let j = 0; j < v.length - 1; j++) {
//                                 let data = v[j].replace(/(<([^>]+)>)/gi, '');
//
//                                 // !===== #84 check deadLine console.log('data', data);
//
//                                 // AC!! & DL Check
//                                 lac = lac < 20 ? ((data == '맞았습니다!!') || (data == '100점') ? 20 : 10) : lac;
//                                 red.push(data);
//                             }
//                         } else {
//                             let x = name0[i].lastIndexOf('data-original-title=');
//                             // !===== #84 check deadLine console.log('case 2:', x);
//                             if (x >= 0) {
//                                 let date = name0[i].split('data-original-title="');
//                                 ldate = date[0].split('data-timestamp="')[1].split('"')[0] + '000';
//
//                                 // !===== #84 check deadLine console.log('date', date);
//                                 // !===== #84 check deadLine console.log('ldate', ldate);
//
//                                 red.push(date[1].split('"')[0]);
//                             }
//                             red.push(name0[i].replace(/(<([^>]+)>)/gi, ''));
//                         }
//                     }
//                     // AC!! & DL Check
//                     if (ac < 20) {
//                         console.log('----------', 'paral:', flag, 'user:', processID, '- lac', lac);
//                         console.log('----------', 'paral:', flag, 'user:', processID, '- ldate', ldate);
//                         console.log('----------', 'paral:', flag, 'user:', processID, '- deadLine', deadLine);
//                         if (ldate <= deadLine) {
//                             ac = lac;
//                         } else ac = 10;
//                     }
//                     returnData.push(red);
//                 });
//             }
//             // // console.log('get html');
//             // const html = await page.$eval('td.result', e => e.outerHTML);
//             // // console.log('html:', html);
//             // // console.log("set result");
//             // ID_LIST[0].result = html.includes('맞았습니다!!') ? 20 : html.includes('틀렸습니다') ? 10 : 0;
//             ID_LIST[0].result = ac;
//             console.log('----------', 'paral:', flag, 'push result');
//             let insert = ID_LIST.shift();
//             insert.status = returnData;
//             assignment_Result.push(insert);
//             // console.log("rere at result:", assignment_Result);
//             console.log('----------', 'paral:', flag, '\t\t', processID, 'is', insert.result);
//             isFinish(ID_LIST, pID, deadLine, assignment_Result, flag);
//         })
//         .catch(error => {
//             console.log('----------', 'paral:', flag, 'html include err', error);
//             console.log('----------', 'paral:', flag, '\t\t', processID, "isn't solve");
//             ID_LIST[0].result = 0;
//             ID_LIST[0].status = '';
//             assignment_Result.push(ID_LIST.shift());
//             isFinish(ID_LIST, pID, deadLine, assignment_Result, flag);
//         });
// }
//
// async function isFinish(ID_LIST, pID, deadLine, assignment_Result, flag) {
//     console.log('----------', 'paral:', flag, '3. isFinish');
//     // console.log("rere at isFin:", assignment_Result);
//     parallelizationControl[flag].waitNotify.notify();
//     parallelizationControl[flag].AsyncTaskExecute = false;
//     if (ID_LIST.length === 0) {
//         // console.log("result: ", assignment_Result);
//         parallelizationControl[flag].fin = true;
//         if (parallelizationControl[0].fin & parallelizationControl[1].fin) {
//             AssignTaskExecute_Assignment_All_Task = false;
//             waitNotify_Assignment_All_Task.notify();
//         }
//     } else {
//         console.log('—————————————————————————————————————————————————————————');
//         console.log(assignment_Result[assignment_Result.length - 1]);
//         while (ID_LIST[0].bojid === '-') {
//             console.log('----------', 'paral:', flag, ID_LIST[0].ID, 'is unsubmitted');
//             ID_LIST.shift();
//         }
//         // console.log("isFin > run", assignment_Result);
//         run(ID_LIST, pID, deadLine, assignment_Result, flag);
//     }
// }
//
// async function checkResult(pid, lectureid, deadLine) {
//     console.log('!——————————check result existence...');
//     let sql = 'select * from assignment_result where assignment_result_id=' + pid + ' and lecture_id=' + lectureid + ' and deadline=' + deadLine + ';';
//     console.log(sql);
//     try {
//         connection.query(sql, async function (err, result, fields) {
//             if (err) {
//                 console.log('!---err in select', err);
//             } else {
//                 console.log('!---select success!');
//                 if (result.length > 0) {
//                     console.log('result is exist.——————————!', result);
//                     console.log(re_asyncReturn);
//                     assignment_Result = JSON.parse(result[0].result);
//
//                     // console.log('notify at check', assignment_Result.length);
//
//                     re_asyncReturn = false;
//                     re_waitReturn.notify();
//                 } else {
//                     console.log('result is not exist.——————————!');
//                     assignment_Result = [];
//                     re_asyncReturn = false;
//                     re_waitReturn.notify();
//                 }
//             }
//         });
//     } catch (err) {
//         console.log('err——————————!', err);
//         re_asyncReturn = false;
//         re_waitReturn.notify();
//     }
// }
//
// /* --------------- Assignments Part --------------- */

/* +-------------- Renewal Part ------------------+ */

/* +++++ UserCheck +++++ */
app.post('/userCheck', (req, res) => {
    console.log('userCheck/get', '- called');
    let sql = 'select user_id from user;';
    connection.query(sql, function (err, result, fields) {
        if (err) {
            console.log('error in userCheck/get', err);
            throw err;
        }
        console.log('userCheck/get', '- callback');
        res.json(result);
    });
});

module.exports = app;
