import fs from "fs";

const KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-flash-latest";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;

async function callGemini(prompt) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function makePrompt(category, topics, startId, count) {
  const pad = n => String(n).padStart(3, "0");
  return `Generate exactly ${count} trivia questions for a cold plunge fitness app called ColdStreak.
Category: "${category}"
Topics: ${topics}

IMPORTANT: Return ONLY a raw JSON array. No markdown, no backticks, no text before or after. Begin with [ and end with ].

Each object:
{
  "id": "q${pad(startId)}",
  "category": "${category}",
  "difficulty": "easy",
  "question": "Question under 85 chars",
  "correct": "Correct answer under 35 chars",
  "wrong": ["Plausible wrong 1", "Plausible wrong 2", "Plausible wrong 3"],
  "explanation": "1-2 sentence surprising fact shown as a Cold Take after answering"
}

IDs: sequential from q${pad(startId)} to q${pad(startId + count - 1)}.
Difficulty mix: ${Math.round(count*0.4)} easy, ${Math.round(count*0.4)} medium, ${Math.round(count*0.2)} hard — set the field accordingly.
Rules:
- Wrong answers must be scientifically plausible, not obviously silly
- Cold Science questions must be accurate — no overclaiming (e.g. don't say cold "burns 300 calories")
- Questions should feel genuinely interesting and educational
- Explanations are the reward — make them memorable
- No duplicate questions`;
}

const batches = [
  {
    category: "Cold Science",
    topics: "vasoconstriction/vasodilation, cold shock response, shivering thermogenesis, non-shivering thermogenesis, brown adipose tissue, vagus nerve, norepinephrine release, core temperature regulation, cold water vs cold air heat loss, cold acclimation/habituation, Wim Hof physiology, cold shock proteins, hormesis, cold and immune response",
    startId: 1,
    count: 50
  },
  {
    category: "Brain & Performance",
    topics: "dopamine and cold, norepinephrine and alertness, cortisol stress response, endorphins, mental resilience and deliberate discomfort, cognitive performance under cold, fine motor control and cold, sympathetic nervous system activation, mood improvement after cold, neuroplasticity, willpower training, focus and cold",
    startId: 51,
    count: 50
  },
  {
    category: "Nature & Extremes",
    topics: "coldest places on Earth, polar bears thermoregulation, wood frogs freeze survival, Arctic fish antifreeze proteins, penguin countercurrent heat exchange, hypothermia stages and survival, cold ocean currents, coldest recorded air temperatures, ice swimming records, permafrost, cold-adapted microorganisms, human cold survival stories",
    startId: 101,
    count: 50
  },
  {
    category: "Health & Recovery",
    topics: "cold and inflammation, contrast therapy hot/cold, muscle recovery and cold, optimal ice bath duration science, heart rate variability, box breathing, Wim Hof breathing, sleep and cold room temperature, hydration and cold, metabolism and cold, cold and longevity research, cold safety (avoiding overclaiming)",
    startId: 151,
    count: 50
  }
];

const allQuestions = [];

for (const batch of batches) {
  console.log(`Generating ${batch.count} questions: ${batch.category}...`);
  try {
    const raw = await callGemini(makePrompt(batch.category, batch.topics, batch.startId, batch.count));
    const cleaned = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/\s*```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    allQuestions.push(...parsed);
    console.log(`  ✓ ${parsed.length} questions`);
  } catch (e) {
    console.error(`  ✗ Error: ${e.message}`);
  }
}

console.log(`\nTotal: ${allQuestions.length} questions`);
fs.mkdirSync("server/data", { recursive: true });
fs.writeFileSync("server/data/brain-freeze-questions.json", JSON.stringify(allQuestions, null, 2));
console.log("Saved to server/data/brain-freeze-questions.json");
