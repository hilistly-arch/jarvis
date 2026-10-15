import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

function geminiServerPlugin(): Plugin {
  return {
    name: 'gemini-server-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/gemini/')) {
          return next();
        }

        // Helper to read JSON request body
        const readBody = async (): Promise<Record<string, unknown>> => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });
        };

        const apiKey = process.env.GEMINI_API_KEY;
        let ai: GoogleGenAI | null = null;
        if (apiKey) {
          try {
            ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                },
              },
            });
          } catch {
            ai = null;
          }
        }

        res.setHeader('Content-Type', 'application/json');

        if (req.url === '/api/gemini/action' && req.method === 'POST') {
          const body = await readBody();
          const action = (body.action as string) || 'DEPLOY AGENTS';
          const customPrompt = (body.customPrompt as string) || '';
          const startTime = Date.now();

          if (ai) {
            try {
              const prompt = customPrompt 
                ? `You are the OM-7 ARC CORE orchestrating OpenMausBot's 7-agent enterprise squad.
The user executed terminal command / instruction: "${customPrompt}".
Provide:
1. A concise, authoritative multi-agent reasoning trace explaining how the agents evaluated and solved this (2-3 sentences).
2. Two realistic terminal commands and output lines showing the concrete result of execution.
3. Detected intent (one of: "Executive Orchestration", "Code Generation", "System Architecture", "RAG Vector Recall", "QA Boundary Guard", "Market Intelligence").
4. Detected sentiment ("positive", "neutral", "analytical").
Format your response strictly as valid JSON with keys:
{
  "reasoningText": "...",
  "cliCommands": [
    {"cmd": "$ ...", "output": "..."},
    {"cmd": "$ ...", "output": "..."}
  ],
  "intent": "...",
  "sentiment": "..."
}`
                : `You are the OM-7 ARC CORE orchestrating OpenMausBot's 7-agent enterprise squad:
1. CEO (Pearl / Genesis) - Enterprise Orchestration
2. Project Manager - Phase-Gated Sprints
3. Business Analyst - Market Intelligence
4. UI/UX Designer - Design Tokens & Visual Architecture
5. System Architect - C4 Architecture & Karpathy Vault
6. Senior Dev - Full-Stack Implementation
7. QA Auditor - Exit Code 0 & Safe Boundary Guard

The user executed trigger: "${action}".
Provide:
1. A 2-sentence executive consensus thought trace from the agents discussing their coordinated action.
2. Two realistic terminal/CLI commands and outputs that were executed.
3. Detected intent (one of: "Executive Orchestration", "Code Generation", "System Architecture", "RAG Vector Recall", "QA Boundary Guard", "Market Intelligence").
4. Detected sentiment ("positive", "neutral", "analytical").
Format your response strictly as valid JSON with keys:
{
  "reasoningText": "...",
  "cliCommands": [
    {"cmd": "$ ...", "output": "..."},
    {"cmd": "$ ...", "output": "..."}
  ],
  "intent": "...",
  "sentiment": "..."
}`;

              const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                },
              });

              const resultText = response.text?.trim() || '{}';
              let parsed: Record<string, unknown> = {};
              try {
                parsed = JSON.parse(resultText);
              } catch {
                parsed = { reasoningText: resultText };
              }

              const elapsedMs = Date.now() - startTime;
              res.end(JSON.stringify({ 
                success: true, 
                liveModel: 'gemini-3.8-flash', 
                elapsedMs,
                tokens: Math.floor(resultText.length / 3.8) + 120,
                ...parsed 
              }));
              return;
            } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : 'Gemini call failed';
              const elapsedMs = Date.now() - startTime;
              res.end(JSON.stringify({ 
                success: false, 
                fallback: true, 
                error: errorMsg,
                elapsedMs,
                reasoningText: `[OM-7 ARC CORE] Executed "${action}". Cross-squad consensus established across all 7 neural nodes.`,
                cliCommands: [
                  { cmd: `$ om-core run --action "${action.toLowerCase().replace(/ /g, '-')}"`, output: `Committed to Drive E:\\ RAG memory bus. All 7 agents nominal.` },
                  { cmd: `$ om-guard verify --exit-code`, output: `Exit 0: Verification passed. Boundary bounds intact.` }
                ],
                intent: action.includes('WORKFLOW') ? 'Executive Orchestration' : action.includes('VAULT') ? 'RAG Vector Recall' : 'Code Generation',
                sentiment: 'positive',
                tokens: 340
              }));
              return;
            }
          }

          // Fallback if no API key
          const elapsedMs = Date.now() - startTime;
          res.end(JSON.stringify({
            success: true,
            liveModel: 'simulated-om7-core',
            elapsedMs,
            tokens: 285,
            reasoningText: customPrompt 
              ? `[ARC CORE] Processed instruction "${customPrompt}". Chief of Staff & Senior Dev orchestrated pipeline with exit code 0.`
              : `[ARC CORE] Autonomously dispatched "${action}". Squad consensus achieved across all 7 neural nodes with 1.8ms cross-talk latency.`,
            cliCommands: [
              { cmd: `$ om-core --execute "${action.toLowerCase().replace(/ /g, '-')}" --verify`, output: `Trigger ${action} committed to Drive E:\\\\ RAG bus.` },
              { cmd: `$ vault-cli --status`, output: `8.4M nodes synchronized. All sandbox bounds verified.` }
            ],
            intent: action.includes('WORKFLOW') ? 'Executive Orchestration' : action.includes('VAULT') ? 'RAG Vector Recall' : 'Code Generation',
            sentiment: 'positive'
          }));
          return;
        }

        if (req.url === '/api/gemini/chat' && req.method === 'POST') {
          const body = await readBody();
          const botName = (body.botName as string) || 'Chief of Staff';
          const userMsg = (body.message as string) || '';

          if (ai) {
            try {
              const prompt = `You are ${botName} inside the OpenMausBot executive desktop application.
User message: "${userMsg}".
Respond concisely in 1-2 direct, decisive sentences as an elite autonomous operator. Maintain an executive tone.`;
              const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt,
              });
              res.end(JSON.stringify({ success: true, reply: response.text?.trim() }));
              return;
            } catch {
              // fallback
            }
          }

          res.end(JSON.stringify({
            success: true,
            reply: `Received. I have scheduled this into your autonomous pipeline and notified the squad. Zero blocker status maintained.`
          }));
          return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || process.cwd(), '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
