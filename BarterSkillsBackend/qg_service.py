# 

#lets use fallback que for deployment
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Question Generation Service")

class QGRequest(BaseModel):
    summary: str

@app.post("/generate-questions")
async def generate_questions(req: QGRequest):
    text = (req.summary or "").strip()

    topic = text.split(".")[0].strip() if text else "this video"

    return {
        "questions": [
            f"What is the main idea discussed in {topic}?",
            f"What are the key points the viewer should remember from {topic}?",
            f"How would you summarize {topic} in one sentence?"
        ]
    }