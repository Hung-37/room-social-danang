const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

export async function analyzeWithOllama(text: string) {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL;
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
  
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      prompt: `Phân tích bài đăng phòng trọ dưới đây. Trả về JSON với các khóa:
- summary: tóm tắt ngắn gọn (2-3 câu)
- riskLevel: "low"|"medium"|"high" (dựa trên tính tin cậy)
- missingInformation: mảng các thông tin còn thiếu (ví dụ: ["giá", "địa chỉ", "số điện thoại"])
- suggestedPrice: giá ước tính nếu có thể, null nếu không
- suggestedArea: diện tích ước tính nếu có thể, null nếu không
- location: khu vực ước tính (ví dụ: "Hòa Khánh", "Mỹ An", "Trung tâm"), null nếu không xác định

Chỉ dựa trên thông tin có trong bài viết, không bịa thêm. JSON output:\n\n${text}`,
      format: 'json'
    }),
    signal: AbortSignal.timeout(30_000)
  });
  
  if (!response.ok) throw new Error(`Ollama trả về HTTP ${response.status}.`);
  const payload = await response.json() as { response?: string };
  if (!payload.response) throw new Error('Ollama không trả về kết quả.');
  
  try {
    return JSON.parse(payload.response);
  } catch {
    // Fallback nếu JSON parse fail
    return {
      summary: payload.response.substring(0, 200),
      riskLevel: 'medium',
      missingInformation: [],
      suggestedPrice: null,
      suggestedArea: null,
      location: null
    };
  }
}