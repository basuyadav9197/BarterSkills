from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import T5Tokenizer, T5ForConditionalGeneration

app = FastAPI(title="Question‑Generation Service")

class QGRequest(BaseModel):
    summary: str

MODEL_ID = "valhalla/t5-small-qg-prepend"
tokenizer = None
model = None


def build_fallback_questions(summary: str, count: int = 3) -> list[str]:
    text = (summary or "this video").strip() or "this video"
    topic = text.split(".")[0].strip() or "this video"
    return [
        f"What is the main idea discussed in {topic}?",
        f"What are the key points the viewer should remember from {topic}?",
        f"How would you summarize {topic} in one sentence?",
    ][: max(1, count)]


def load_model():
    global tokenizer, model
    if tokenizer is None or model is None:
        tokenizer = T5Tokenizer.from_pretrained(MODEL_ID)
        model = T5ForConditionalGeneration.from_pretrained(MODEL_ID)
    return tokenizer, model

@app.post("/generate-questions")
async def generate_questions(req: QGRequest):
    text = req.summary.strip()
    if not text:
        raise HTTPException(400, detail="`summary` must be non-empty")

    sent_count = max(1, text.count("."))
    n_q = min(max(3, sent_count), 7)

    try:
        local_tokenizer, local_model = load_model()
        input_text = "generate questions: " + text
        inputs = local_tokenizer(
            input_text,
            return_tensors="pt",
            max_length=512,
            truncation=True,
        )

        outputs = local_model.generate(
            **inputs,
            max_length=64,
            do_sample=True,
            top_p=0.9,
            temperature=1.2,
            no_repeat_ngram_size=2,
            num_return_sequences=n_q,
        )

        qs = []
        for o in outputs:
            q = local_tokenizer.decode(o, skip_special_tokens=True).strip()
            if len(q) > 5 and q not in qs:
                qs.append(q)

        if qs:
            return {"questions": qs}
    except Exception:
        pass

    return {"questions": build_fallback_questions(text, n_q)}
