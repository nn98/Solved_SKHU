const prisma = require('../prisma/client');

class ProblemModel {
    // 최다 해결 문제 (Solve 테이블에서 problemId별로 그룹화 후 count)
    static async getMaxProblems() {
        // groupBy + join은 Prisma에서 직접 지원하지 않으므로 2단계로 구현
        const maxSolved = await prisma.solve.groupBy({
            by: ['problem_id'],
            _count: { problem_id: true },
            orderBy: { _count: { problem_id: 'desc' } },
            take: 10,
        });

        const problemIds = maxSolved.map(item => item.problem_id);
        const problems = await prisma.problem.findMany({
            where: { problem_id: { in: problemIds } },
            select: {
                problem_id: true,
                namekr: true,
                rate: true,
                solved_rank: true,
            }
        });

        return problemIds.map(pid => {
            const problem = problems.find(p => p.problem_id === pid);
            const count = maxSolved.find(m => m.problem_id === pid)._count.problem_id;
            return { ...problem, solvedCount: count };
        });
    }

    // 최소 해결 문제
    static async getMinProblems() {
        const minSolved = await prisma.solve.groupBy({
            by: ['problem_id'],
            _count: { problem_id: true },
            orderBy: { _count: { problem_id: 'asc' } },
            take: 10,
        });

        const problemIds = minSolved.map(item => item.problem_id);
        const problems = await prisma.problem.findMany({
            where: { problem_id: { in: problemIds } },
            select: {
                problem_id: true,
                namekr: true,
                rate: true,
                solved_rank: true,
            }
        });

        return problemIds.map(pid => {
            const problem = problems.find(p => p.problem_id === pid);
            const count = minSolved.find(m => m.problem_id === pid)._count.problem_id;
            return { ...problem, solvedCount: count };
        });
    }

    // 베스트 문제 (정규식은 $queryRaw로 처리)
    static async getBestProblems() {
        return prisma.$queryRaw`
            SELECT
                p.problem_id as problem_id,
                p.namekr as namekr,
                p.rate as rate,
                p.SOLVED_RANK as solved_rank
            FROM problem p
            WHERE p.problem_id IN (SELECT s.problem_id FROM solve s)
              AND p.namekr REGEXP '^[가-힇 % %]*$'
            ORDER BY CAST(p.rate AS SIGNED) DESC
                LIMIT 10
        `;
    }

    // 워스트 문제 (정규식은 $queryRaw로 처리)
    static async getWorstProblems() {
        return prisma.$queryRaw`
            SELECT
                p.problem_id as problem_id,
                p.namekr as namekr,
                p.rate as rate,
                p.SOLVED_RANK as solved_rank
            FROM problem p
            WHERE p.problem_id IN (SELECT s.problem_id FROM solve s)
              AND p.namekr REGEXP '^[가-힇 % %]*$'
            ORDER BY CAST(p.rate AS SIGNED) ASC
                LIMIT 10
        `;
    }

    static async getRandomProblem () {
        // 1. 조건에 맞는 문제 개수 조회
        const count = await prisma.problem.count({
            where: {
                solved_rank: {
                    gte: 1,
                    lte: 17
                }
            }
        });

        if (count === 0) return null;

        // 2. 랜덤 인덱스 생성
        const randomIndex = Math.floor(Math.random() * count);

        // 3. 랜덤 문제 1개 조회
        const problems = await prisma.problem.findMany({
            where: {
                solved_rank: {
                    gte: 1,
                    lte: 17
                }
            },
            skip: randomIndex,
            take: 1
        });

        return problems[0] || null;
    }
}

module.exports = ProblemModel;
