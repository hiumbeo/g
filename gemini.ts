import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI();
  }
  return aiInstance;
}

export async function askGeminiChat(
  prompt: string,
  userId: string,
  userName: string,
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return '⚠️ Chưa cấu hình GEMINI_API_KEY trên server. Vui lòng thêm GEMINI_API_KEY để sử dụng tính năng AI!';
  }

  const ai = getAI();
  if (!ai) {
    return '⚠️ Không thể khởi tạo kết nối tới Gemini AI.';
  }

  try {
    const systemInstruction = `Bạn là SentinelBot AI - trợ lý Discord thông minh, thân thiện và am hiểu công nghệ. Bạn đang trò chuyện với ${userName} (ID: ${userId}). Trả lời súc tích, tự nhiên, hỗ trợ tiếng Việt chuẩn.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || 'Không có phản hồi từ AI.';
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return `⚠️ Lỗi khi gọi Gemini AI: ${error.message || 'Lỗi không xác định'}`;
  }
}
