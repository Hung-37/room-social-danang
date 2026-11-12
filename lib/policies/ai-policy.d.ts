export type AiAnalysis = {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  missingInformation: string[];
  suggestedPrice: number | null;
  suggestedArea: number | null;
  location: string | null;
};
export function validateAiAnalysis(value: unknown): AiAnalysis;
export function parseAiResponse(text: unknown): AiAnalysis;
