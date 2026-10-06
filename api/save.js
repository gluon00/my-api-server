import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
    // 보안 통과 설정 (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'POST 요청만 가능합니다.' });

    try {
        const { name, age } = req.body;
        
        // Vercel 환경변수에서 비밀번호와 아이디를 가져옴
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const path = 'data/users.csv';

        const newRow = `${name},${age},${new Date().toISOString()}\n`;
        let sha = null;
        let existingContent = "이름,나이,입력시간\n";

        // 기존 CSV 파일이 있는지 확인
        try {
            const { data } = await octokit.repos.getContent({ owner, repo, path });
            sha = data.sha;
            existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
        } catch (e) {
            // 파일이 없으면 무시하고 최초 생성
        }

        // 새 데이터를 덧붙여서 깃허브에 저장
        await octokit.repos.createOrUpdateFileContents({
            owner, repo, path,
            message: `데이터 추가: ${name}`,
            content: Buffer.from(existingContent + newRow).toString('base64'),
            ...(sha && { sha })
        });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
