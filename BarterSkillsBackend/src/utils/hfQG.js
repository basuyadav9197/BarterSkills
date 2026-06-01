import axios from "axios";

console.log(" QG service URL:", process.env.QG_URL);
const QG_SERVICE_URL = process.env.QG_URL || "http://127.0.0.1:8001";

function buildFallbackQuestions(summary) {
  const cleaned = (summary || "this video").replace(/\s+/g, " ").trim();
  const topic = cleaned
    .split(/\.|\n|\?|!/)
    .map((part) => part.trim())
    .find(Boolean) || "this video";

  return [
    `What is the main idea discussed in ${topic}?`,
    `What are the key points the viewer should remember from ${topic}?`,
    `What action or takeaway is suggested by ${topic}?`,
    `Which example or detail in ${topic} is most important?`,
    `How would you summarize ${topic} in one sentence?`,
  ];
}

export async function fetchQuestions(summary) {
  const preview = (summary || "").slice(0, 80);
  console.log(" Calling QG on:", preview + (summary?.length > 80 ? "..." : ""));
  console.log(" QG_URL:", QG_SERVICE_URL);

  try {
    const resp = await axios.post(
      `${QG_SERVICE_URL}/generate-questions`,
      { summary },
      { timeout: 30000, family: 4 }
    );

    if (!resp.data?.questions?.length) {
      return buildFallbackQuestions(summary);
    }

    return resp.data.questions;
  } catch (error) {
    console.warn("QG service unavailable, using fallback questions:", error.message);
    return buildFallbackQuestions(summary);
  }
}
