// /service/crawlers/default.js

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

/**
 * 병렬 크롤링 제어용 객체
 * @typedef {Object} ParallelControl
 * @property {boolean} AsyncTaskExecute - 병렬 작업 실행 여부
 * @property {WaitNotify} waitNotify - 병렬 작업 완료 알림 객체
 * @property {boolean} fin - 병렬 작업 완료 여부
 */

/**
 * WaitNotify 유틸리티 (Promise 기반 대기/알림)
 */
class WaitNotify {
    constructor() {
        this._promise = null;
        this._resolve = null;
    }
    wait() {
        if (!this._promise) {
            this._promise = new Promise((resolve) => {
                this._resolve = resolve;
            });
        }
        return this._promise;
    }
    notify() {
        if (this._resolve) {
            this._resolve();
            this._promise = null;
            this._resolve = null;
        }
    }
}

/**
 * 과제 채점 상태 크롤링
 * @param {Array} ID_LIST - 학생 객체 리스트 (각 객체에 bojid 등 포함)
 * @param {string|number} pID - 문제 ID
 * @param {number} deadLine - 마감 타임스탬프(ms)
 * @returns {Promise<Array>} - 채점 결과가 포함된 학생 객체 리스트
 */
async function crawlAssignmentStatus(ID_LIST, pID, deadLine) {
    console.log('at crawlAssignmentStatus', ID_LIST, pID, deadLine);
    let assignment_Result = [];
    let parallelizationControl = [
        { AsyncTaskExecute: false, waitNotify: new WaitNotify(), fin: false },
        { AsyncTaskExecute: false, waitNotify: new WaitNotify(), fin: false },
    ];

    // 병렬 분할
    let head_assignment_Result = [];
    let head_ID_LIST = ID_LIST.slice(0, Math.floor(ID_LIST.length / 2));
    let tail_assignment_Result = [];
    let tail_ID_LIST = ID_LIST.slice(Math.floor(ID_LIST.length / 2));

    // 병렬 실행
    const run = async (ID_LIST, pID, deadLine, assignment_Result, flag) => {
        if (ID_LIST.length === 0) return;
        let processID = ID_LIST[0].bojid;
        let url =
          'https://www.acmicpc.net/status?problem_id=' +
          pID +
          '&user_id=' +
          processID +
          '&language_id=-1&result_id=-1';
        console.log('url',url)
        await execute(ID_LIST, pID, deadLine, processID, url, assignment_Result, flag);
    };

    const execute = async (
      ID_LIST,
      pID,
      deadLine,
      processID,
      url,
      assignment_Result,
      flag
    ) => {
        try {
            if (parallelizationControl[flag].AsyncTaskExecute) {
                await parallelizationControl[flag].waitNotify.wait();
            }
            parallelizationControl[flag].AsyncTaskExecute = true;

            const browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Referer': 'https://www.acmicpc.net/'
            });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });
            // await page.waitForSelector('tr', { timeout: 5000 }); // tr 태그가 생길 때까지 대기

            const content = await page.content();
            console.log('content',content);
            const $ = cheerio.load(content);
            const lists = $('tr');
            let returnData = [];
            let ac = 0;
            let ldate;

            if (lists.length > 1) {
                lists.each((index, list) => {
                    let red = [];
                    let lac = 0;
                    let name0 = $(list).find('td').toString().split('<td>');
                    for (let i = 1; i < name0.length; i++) {
                        if (name0[i].split('</td>').length > 3) {
                            let v = name0[i].split('</td>');
                            for (let j = 0; j < v.length - 1; j++) {
                                let data = v[j].replace(/(<([^>]+)>)/gi, '');
                                lac = lac < 20 ? (data === '맞았습니다!!' || data === '100점' ? 20 : 10) : lac;
                                red.push(data);
                            }
                        } else {
                            let x = name0[i].lastIndexOf('data-original-title=');
                            if (x >= 0) {
                                let date = name0[i].split('data-original-title="');
                                ldate = date[0].split('data-timestamp="')[1].split('"')[0] + '000';
                                red.push(date[1].split('"')[0]);
                            }
                            red.push(name0[i].replace(/(<([^>]+)>)/gi, ''));
                        }
                    }
                    if (ac < 20) {
                        if (ldate <= deadLine) {
                            ac = lac;
                        } else ac = 10;
                    }
                    returnData.push(red);
                });
            }
            ID_LIST[0].result = ac;
            let insert = ID_LIST.shift();
            insert.status = returnData;
            assignment_Result.push(insert);
            await browser.close();
            await isFinish(ID_LIST, pID, deadLine, assignment_Result, flag);
        } catch (error) {
            console.log('error in crawlAssignmentStatus, error :', error);
            ID_LIST[0].result = 0;
            ID_LIST[0].status = '';
            assignment_Result.push(ID_LIST.shift());
            await isFinish(ID_LIST, pID, deadLine, assignment_Result, flag);
        }
    };

    const isFinish = async (
      ID_LIST,
      pID,
      deadLine,
      assignment_Result,
      flag
    ) => {
        parallelizationControl[flag].waitNotify.notify();
        parallelizationControl[flag].AsyncTaskExecute = false;
        if (ID_LIST.length === 0) {
            parallelizationControl[flag].fin = true;
            if (
              parallelizationControl[0].fin &&
              parallelizationControl[1].fin
            ) {
                // 병렬 작업 모두 완료
            }
        } else {
            while (ID_LIST[0] && ID_LIST[0].bojid === '-') {
                ID_LIST.shift();
            }
            if (ID_LIST.length > 0) {
                await run(ID_LIST, pID, deadLine, assignment_Result, flag);
            }
        }
    };

    // 병렬 실행 시작
    const tasks = [];
    if (head_ID_LIST.length > 0)
        tasks.push(run(head_ID_LIST, pID, deadLine, head_assignment_Result, 0));
    if (tail_ID_LIST.length > 0)
        tasks.push(run(tail_ID_LIST, pID, deadLine, tail_assignment_Result, 1));
    await Promise.all(tasks);

    // 결과 합치기
    assignment_Result.push(...head_assignment_Result, ...tail_assignment_Result);
    return assignment_Result;
}

module.exports = { crawlAssignmentStatus, WaitNotify };
