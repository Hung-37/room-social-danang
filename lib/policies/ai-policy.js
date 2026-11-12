export function validateAiAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('AI trả về dữ liệu không đúng cấu trúc.');
  const { summary, riskLevel, missingInformation, suggestedPrice, suggestedArea, location } = value;
  if (
    typeof summary !== 'string' ||
    !summary.trim() ||
    summary.length > 1200 ||
    !['low', 'medium', 'high'].includes(riskLevel) ||
    !Array.isArray(missingInformation) ||
    missingInformation.length > 20 ||
    missingInformation.some((s) => typeof s !== 'string' || s.length > 150) ||
    !(
      suggestedPrice === null ||
      (typeof suggestedPrice === 'number' &&
        Number.isFinite(suggestedPrice) &&
        suggestedPrice >= 1 &&
        suggestedPrice <= 1e9)
    ) ||
    !(
      suggestedArea === null ||
      (typeof suggestedArea === 'number' &&
        Number.isFinite(suggestedArea) &&
        suggestedArea >= 0.01 &&
        suggestedArea <= 100000)
    ) ||
    !(location === null || (typeof location === 'string' && location.length <= 200))
  )
    throw new Error('AI trả về trường dữ liệu không hợp lệ.');
  return {
    summary: summary.trim(),
    riskLevel,
    missingInformation,
    suggestedPrice,
    suggestedArea,
    location
  };
}
export function parseAiResponse(text) {
  if (typeof text !== 'string' || text.length > 12000)
    throw new Error('Phản hồi AI thiếu hoặc quá dài.');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('AI không trả về JSON hợp lệ.');
  }
  return validateAiAnalysis(value);
}
