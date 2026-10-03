import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

let embedder: any = null;

async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline(
            "feature-extraction",
            "Xenova/all-mpnet-base-v2"
        );
    }
    return embedder;
}

async function embedQuery(query: string) {
    const embed = await getEmbedder();

    const output = await embed(query, {
        pooling: "mean",
        normalize: true,
    });

    return Array.from(output.data) as number[];
}

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message?.trim()) {
            return new Response(
                JSON.stringify({ error: "Empty query" }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // 1. Embed user query
        const queryEmb = await embedQuery(message);

        // 2. Retrieve relevant chunks
        const { data: chunks, error } = await supabase.rpc(
            "match_documents",
            {
                query_embedding: queryEmb,
                match_count: 8,

                // TEMPORARY:
                // Remove the source filter until we verify
                // the exact metadata stored in Supabase.
            }
        );

        if (error) {
            console.error("Supabase RPC error:", error);
            throw error;
        }

        // 3. Build context
        const context = (chunks ?? [])
            .map(
                (c: any, i: number) =>
                    `[${i + 1}] (Page ${c.metadata?.page ?? "?"}) ${c.content}`
            )
            .join("\n\n");

        if (!context) {
            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();

                    controller.enqueue(
                        encoder.encode(
                            "I couldn't find this in the provided document."
                        )
                    );

                    controller.enqueue(
                        encoder.encode("\n---CITATIONS---\n[]")
                    );

                    controller.close();
                },
            });

            return new Response(stream, {
                status: 200,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Cache-Control": "no-cache",
                },
            });
        }

        // 4. Ask Groq
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            temperature: 0.2,

            messages: [
                {
                    role: "system",
                    content:
                        "You are a strict RAG assistant. " +
                        "Answer ONLY using the CONTEXT. " +
                        "If the answer is not present, say: " +
                        "'I couldn't find this in the provided document.' " +
                        "Cite sources like [1], [2] and include page numbers " +
                        "(e.g., Page 93).",
                },
                {
                    role: "user",
                    content: `CONTEXT:\n${context}\n\nQUESTION: ${message}`,
                },
            ],
        });

        const answer =
            completion.choices[0]?.message?.content ||
            "I couldn't generate an answer.";

        // 5. Transform retrieved chunks into the format
        // expected by page.tsx.
        const citations = (chunks ?? []).map((c: any, i: number) => ({
            id: i + 1,
            page: String(c.metadata?.page ?? "?"),
            similarity: String(((c.similarity ?? c.score ?? 0) * 100).toFixed(1)),
            content: c.content,
            fullContent: c.content,
        }));

        // 6. Send exactly what page.tsx expects.
        const responseText =
            `${answer}\n\n` +
            `---CITATIONS---\n` +
            `${JSON.stringify(citations)}`;

        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                controller.enqueue(encoder.encode(responseText));
                controller.close();
            },
        });

        return new Response(stream, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error: any) {
        console.error("CHAT API ERROR:", error);

        return new Response(
            JSON.stringify({
                error: error?.message || String(error),
                details: error,
            }),
            {
                status: 500,
                headers: { "content-type": "application/json" },
            }
        );
    }
}