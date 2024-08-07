const { GoogleGenerativeAI } = require("@google/generative-ai");
const apiKey = 'AIzaSyDOKW5n2dbwbt2E_gbI-08Io5K0aUlUYDA';

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  // For text-only input, use the gemini-pro model
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

  const prompt = "Tell me about ongoin Euro 2024 quarter finalresult"

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  console.log(text);
}

run();
