import os
import json
import re
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

def detect_broll_moments(transcript: list, intensity: int) -> list:
    if not transcript:
        return []

    transcript_text = "\n".join(
        [f"[{seg['start']}s - {seg['end']}s] {seg['text']}" for seg in transcript]
    )

    total_duration = transcript[-1]["end"] if transcript else 60
    minutes = max(1, total_duration / 60)
    density_map = {1: 0.5, 2: 0.8, 3: 1.2, 4: 1.8, 5: 2.5, 6: 3.2, 7: 4.0, 8: 5.0, 9: 6.0, 10: 7.0}
    density = density_map.get(intensity, 2.5)
    target_count = max(2, int(minutes * density))

    prompt = f"""You are an expert video editor creating B-roll suggestions for a YouTube video.

TRANSCRIPT:
{transcript_text}

YOUR TASK:
Identify {target_count} perfect moments for B-roll footage insertion.

STRICT RULES FOR search_query:
- NEVER use generic terms like "people working", "person working", "team working", "office workers"
- ALWAYS be SPECIFIC to what is actually being said
- Include a SETTING or LOCATION when possible
- Include an ACTION or EMOTION when possible
- Examples of GOOD queries: "student studying library books night", "london city skyline aerial", "job interview office handshake", "airplane window seat clouds", "university campus students walking", "data scientist laptop screen code", "stressed person looking at bills", "coffee shop laptop freelancer"
- Examples of BAD queries: "people working", "person thinking", "activity", "work"

CATEGORY RULES:
- emotion: when speaker expresses feelings (stress, happiness, fear, love, excitement)
- activity: when speaker describes doing something specific
- location: when speaker mentions a place (city, country, school, office, home)
- object: when speaker mentions a specific thing (laptop, money, passport, degree)
- event: when speaker describes an event (graduation, interview, exam, trip)

RESPOND ONLY with a valid JSON array, no markdown, no explanation:
[
  {{
    "timestamp": 5.2,
    "end_timestamp": 8.5,
    "text": "exact words from transcript",
    "search_query": "specific descriptive horizontal video search term",
    "category": "emotion|activity|location|object|event",
    "reason": "why this moment needs B-roll"
  }}
]

Return ONLY the JSON array."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=3000,
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"^```\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        raw = raw.strip()

        moments = json.loads(raw)
        cleaned = []
        for m in moments:
            if isinstance(m.get("timestamp"), (int, float)):
                query = str(m.get("search_query", ""))
                # Block generic queries and force re-label
                blocked = ["people working", "person working", "team working",
                           "office workers", "people at work", "working people",
                           "person thinking", "people thinking"]
                if any(b in query.lower() for b in blocked):
                    query = _extract_specific_query(str(m.get("text", "")))
                cleaned.append({
                    "timestamp": float(m["timestamp"]),
                    "end_timestamp": float(m.get("end_timestamp", m["timestamp"] + 3)),
                    "text": str(m.get("text", "")),
                    "search_query": query,
                    "category": str(m.get("category", "activity")),
                    "reason": str(m.get("reason", "")),
                    "selected_media": None,
                })
        return cleaned

    except Exception as e:
        print(f"Groq API error: {e}")
        return _fallback_detection(transcript, target_count)


def _extract_specific_query(text: str) -> str:
    """Extract a specific visual query from transcript text."""
    text_lower = text.lower()
    
    # Location keywords
    locations = ["uk", "london", "india", "university", "school", "college", "office",
                 "home", "abroad", "city", "campus", "airport", "hospital", "cafe"]
    for loc in locations:
        if loc in text_lower:
            return f"{loc} cityscape aerial view"
    
    # Activity keywords  
    activities = {
        "study": "student studying books library",
        "learn": "student learning classroom lecture",
        "job": "job interview professional office",
        "work": "professional career office desk",
        "money": "salary money finance calculator",
        "master": "university graduation ceremony",
        "degree": "university diploma graduation",
        "stress": "stressed student exam pressure",
        "interview": "job interview handshake office",
        "intern": "intern office professional",
        "passion": "person inspired creative thinking",
        "abroad": "international travel airport passport",
        "loan": "financial documents bank loan",
        "marry": "couple wedding romantic",
        "data": "data analysis laptop screen graphs",
    }
    for kw, query in activities.items():
        if kw in text_lower:
            return query
    
    return "cinematic establishing shot city"


def _fallback_detection(transcript: list, count: int) -> list:
    moments = []
    step = max(1, len(transcript) // count)
    for i in range(0, len(transcript), step):
        if len(moments) >= count:
            break
        seg = transcript[i]
        query = _extract_specific_query(seg["text"])
        moments.append({
            "timestamp": seg["start"],
            "end_timestamp": seg["end"],
            "text": seg["text"],
            "search_query": query,
            "category": "activity",
            "reason": "Auto-detected moment",
            "selected_media": None,
        })
    return moments
