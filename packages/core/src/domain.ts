export type Ranking = "Latest" | "Balanced" | "Most helpful";
export type Candidate = {
  id: string;
  created_at: string;
  helpful: number;
  reputation: number;
  reason: string;
};
export interface Ranker {
  rank(items: Candidate[]): Candidate[];
}
export function ranker(style: Ranking): Ranker {
  return {
    rank: (items) =>
      [...items].sort((a, b) =>
        style === "Latest"
          ? b.created_at.localeCompare(a.created_at)
          : style === "Most helpful"
            ? b.helpful - a.helpful
            : b.helpful + b.reputation - (a.helpful + a.reputation),
      ),
  };
}
export interface TranslationProvider {
  translate(text: string, source: string, target: string): Promise<string>;
}
export interface TranscriptionProvider {
  transcribe(uri: string, language: string): Promise<string>;
}
export interface ScanProvider {
  scan(uri: string): Promise<{ safe: boolean; reason?: string }>;
}
export interface PaymentProvider {
  tip(
    creator: string,
    amountPaise: number,
  ): Promise<{ id: string; mode: "test" }>;
  subscribe(creator: string): Promise<{ id: string; mode: "test" }>;
}
export interface SearchProvider {
  search(query: string, language: string): Promise<unknown[]>;
}
export interface AIDetectionProvider {
  detect(text: string): Promise<{ probability: number; model: string }>;
}
export type Rating = { userId: string; viewpoint: string; helpful: boolean };
export interface NotesConsensus {
  visible(ratings: Rating[]): boolean;
}
export const bridging: NotesConsensus = {
  visible: (ratings) => {
    const unique = [...new Map(ratings.map((r) => [r.userId, r])).values()];
    if (unique.length < 4) return false;
    const groups = new Map<string, Rating[]>();
    for (const r of unique)
      groups.set(r.viewpoint, [...(groups.get(r.viewpoint) || []), r]);
    return (
      [...groups.values()].filter(
        (rs) =>
          rs.length >= 2 &&
          rs.filter((r) => r.helpful).length / rs.length >= 0.75,
      ).length >= 2
    );
  },
};
export const hostileReply = (text: string) =>
  /\b(idiot|stupid|shut up|moron)\b/i.test(text);
export const flags = {
  transcription: false,
  translation: false,
  payments: false,
  aiDetection: false,
};
export const mediaLimits = {
  imageBytes: 10 * 1024 * 1024,
  videoBytes: 25 * 1024 * 1024,
  videoSeconds: 60,
  voiceBytes: 5 * 1024 * 1024,
  voiceSeconds: 120,
};
export function validatePost(body: string, max = 500) {
  if (!body.trim()) throw new Error("Write something before posting.");
  if ([...body].length > max)
    throw new Error(`Posts may contain at most ${max} characters.`);
  return body.trim();
}
export function log(
  event: string,
  fields: Record<string, string | number | boolean> = {},
) {
  console.info(
    JSON.stringify({ event, time: new Date().toISOString(), ...fields }),
  );
}
