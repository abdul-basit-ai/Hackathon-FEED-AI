// Explicitly fictional fixtures. Never used as a fallback for failed live calls.
export class DemoConnector {
  async search(term, count, periodDays, now) {
    return { skipped: 0, videos: Array.from({ length: Math.min(count, 8) }, (_, index) => ({
      id: crypto.randomUUID(), provider_id: `fictional:${term}:${index}`, url: `https://example.com/fictional-video/${encodeURIComponent(term)}/${index}`,
      platform: 'demo', creator: 'fictional_creator',
      published_at: new Date(now.getTime() - Math.min(periodDays * 86400000 - 1, (index + 1) * 3600000)).toISOString(),
      description: `Fictional ${term} ${index % 2 ? 'product demonstration' : 'creator review'}.`,
      transcript: '', visual_description: '', views: (index + 1) * 1000, likes: (index + 1) * 50,
      comments: index * 4, shares: null, brands: [term], source_url_derived: false,
    })) };
  }
}

export class DemoAnalyzer {
  async analyze(input, videos) {
    return {
      executive_summary: `FICTIONAL DEMO: sample ${input.skill} for ${input.query}. No Oriane search or OpenAI analysis was performed.`,
      recommendations: ['Connect real providers before making decisions.', 'Review the original sources in live mode.', 'Test content ideas against a broader sample.'],
      insights: [
        { title: 'Fictional product demonstration', explanation: 'Demo UI example only; this is not a real-world finding.', evidence_video_ids: [videos[0].id] },
        { title: 'Fictional sample performance', explanation: 'Metrics are generated fixture values, not measured video performance.', evidence_video_ids: [videos.at(-1).id] },
        { title: 'Fictional publication pattern', explanation: 'Dates are generated solely to exercise the chart contract.', evidence_video_ids: [videos[0].id] },
      ],
      themes: [{ label: 'Fictional demo content', video_ids: videos.map((v) => v.id) }],
    };
  }
}

export class MemoryStore {
  constructor() { this.results = new Map(); this.quotas = new Map(); }
  async consumeQuota(owner) {
    const minute = Math.floor(Date.now() / 60000);
    const current = this.quotas.get(owner);
    const count = current?.minute === minute ? current.count + 1 : 1;
    this.quotas.set(owner, { minute, count });
    if (count > 5) { const { AppError } = await import('./core.js'); throw new AppError(429, 'RATE_LIMITED', 'Limit of five analyses per minute reached.'); }
  }
  async save(owner, input, result) {
    this.results.set(result.analysis_id, { owner, input: structuredClone(input), result: structuredClone(result) });
    if (this.results.size > 100) this.results.delete(this.results.keys().next().value);
  }
  async get(owner, id) { const saved = this.results.get(id); return saved?.owner === owner ? structuredClone(saved.result) : null; }
  async list(owner, limit, offset) {
    return [...this.results.values()].filter((v) => v.owner === owner).reverse().slice(offset, offset + limit).map(({ input, result }) => ({
      id: result.analysis_id, skill: result.skill, query: input.query, parameters: input,
      status: result.status, created_at: result.generated_at,
    }));
  }
}
