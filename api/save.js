import { Octokit } from "@octokit/rest";

const ALLOWED_ORIGIN = 'https://your-page-domain.com'; // 실제 도메인으로 변경

const esc = (v) => {
  let s = String(v).replace(/"/g, '""');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s}"`;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'POST 요청만 가능합니다.' });

  const { name, age } = req.body || {};
  const ageNum = Number(age);
  if (!name || String(name).length > 50 || !Number.isInteger(ageNum) || ageNum < 0 || ageNum > 150) {
    return res.status(400).json({ success: false, message: '입력값이 올바르지 않습니다.' });
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = 'data/users.csv';
  const newRow = `${esc(name)},${ageNum},${new Date().toISOString()}\n`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let sha, content = "\uFEFF이름,나이,입력시간\n";
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        sha = data.sha;
        content = Buffer.from(data.content, 'base64').toString('utf-8');
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      await octokit.repos.createOrUpdateFileContents({
        owner, repo, path,
        message: `데이터 추가`,
        content: Buffer.from(content + newRow).toString('base64'),
        ...(sha && { sha })
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      if (error.status === 409 && attempt < 2) continue; // sha 충돌 시 재시도
      return res.status(500).json({ success: false, message: '저장 중 오류가 발생했습니다.' });
    }
  }
}
