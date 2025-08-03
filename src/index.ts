import { v4 as uuidv4 } from 'uuid';

export interface Env {
	DB: D1Database;
	OPENAI_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
				status: 405,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		try {
			const { destination, durationDays } = await request.json();

			if (!destination || !durationDays || typeof destination !== 'string' || typeof durationDays !== 'number' || durationDays <= 0) {
				return new Response(JSON.stringify({ error: 'Invalid input. Please provide a valid destination (string) and durationDays (positive number).' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const jobId = uuidv4();
			const createdAt = Date.now();

			// 1. Immediately create a "processing" record
			const insertPromise = env.DB.prepare(
				"INSERT INTO itineraries (jobId, status, destination, durationDays, createdAt) VALUES (?, ?, ?, ?, ?)"
			).bind(jobId, 'processing', destination, durationDays, createdAt).run();
			
			ctx.waitUntil(insertPromise);

			// 2. Respond instantly with the jobId
			const response = new Response(JSON.stringify({ jobId }), {
				status: 202,
				headers: { 'Content-Type': 'application/json' },
			});

			// 3. Start the LLM generation and final DB update asynchronously
			ctx.waitUntil(
				this.processItinerary(jobId, destination, durationDays, env)
			);

			return response;
		} catch (error) {
			return new Response(JSON.stringify({ error: `Failed to parse request body: ${error}` }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async processItinerary(jobId: string, destination: string, durationDays: number, env: Env): Promise<void> {
		let itineraryJson = null;
		let status = 'failed';
		let errorMessage = null;

		try {
			// 4. Construct the LLM prompt
			const prompt = `Generate a detailed JSON travel itinerary for a ${durationDays}-day trip to ${destination}. The JSON must strictly follow this structure: { "itinerary": [ { "day": 1, "theme": "...", "activities": [ { "time": "Morning", "description": "...", "location": "..." } ] } ] }. The itinerary should have exactly ${durationDays} days. Only provide the JSON object, do not include any other text or markdown.`;

			// 5. Call the LLM API
			const llmResponse = await this.callLLM(prompt, env.OPENAI_API_KEY);
			itineraryJson = llmResponse.itinerary;
			status = 'completed';

		} catch (error: any) {
			console.error(`LLM generation failed for jobId ${jobId}:`, error);
			errorMessage = error.message || 'LLM generation or parsing failed.';
		} finally {
			// 6. Update the D1 record with the result
			const completedAt = Date.now();
			const updatePromise = env.DB.prepare(
				"UPDATE itineraries SET status = ?, completedAt = ?, itinerary = ?, error = ? WHERE jobId = ?"
			).bind(status, completedAt, JSON.stringify(itineraryJson), errorMessage, jobId).run();

			await updatePromise;
		}
	},

	async callLLM(prompt: string, apiKey: string): Promise<any> {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: prompt }],
				response_format: { type: 'json_object' }
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(`LLM API error: ${response.status} - ${JSON.stringify(errorData)}`);
		}

		const data = await response.json();
		const content = data.choices[0].message.content;
		
		return JSON.parse(content);
	}
};
