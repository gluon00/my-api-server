const { Octokit } = require("@octokit/rest");

module.exports = async (req, res) => {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { customerName, phoneNumber, product, quantity } = req.body;

  // 필드 유효성 검사
  if (!customerName || !phoneNumber || !product || !quantity) {
    return res.status(400).json({ success: false, message: "모든 필드를 입력해 주세요." });
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = "data/orders.csv";

  try {
    let sha = null;
    let existingContent = "";

    // 파일이 없을 경우 사용될 CSV 헤더 정의
    const csvHeader = "주문일시,고객명,전화번호,주문상품,수량\n";

    // 1. 기존 CSV 파일 가져오기 시도
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (response.data && response.data.content) {
        sha = response.data.sha;
        // Base64 디코딩
        existingContent = Buffer.from(response.data.content, "base64").toString("utf-8");
      }
    } catch (error) {
      // 404(파일 없음) 에러는 정상적인 첫 생성 상황이므로 통과, 그 외 에러는 throw
      if (error.status !== 404) {
        throw error;
      }
    }

    // 2. CSV 데이터 이스케이프 처리 함수 (쉼표 및 큰따옴표 포함 시 깨짐 방지)
    const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;

    // 한국 표준시(KST) ISO 문자열 생성
    const timestamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const newLine = `${escapeCsv(timestamp)},${escapeCsv(customerName)},${escapeCsv(phoneNumber)},${escapeCsv(product)},${escapeCsv(quantity)}\n`;

    // 3. 누적 내용 조합
    let finalContent = existingContent;
    if (!finalContent) {
      finalContent = csvHeader + newLine;
    } else {
      if (!finalContent.endsWith("\n")) {
        finalContent += "\n";
      }
      finalContent += newLine;
    }

    // 4. 깃허브 저장소에 변경사항 푸시 (Create or Update)
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `order: 신규 상품 주문 접수 (${customerName})`,
      content: Buffer.from(finalContent, "utf-8").toString("base64"),
      sha: sha || undefined, // 기존 파일이 있을 때만 sha 전달
    });

    return res.status(200).json({ success: true, message: "주문이 성공적으로 접수되었습니다." });
  } catch (error) {
    console.error("GitHub API Error:", error);
    return res.status(500).json({
      success: false,
      message: "데이터 저장 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};
