import { expect, test } from "bun:test"
import {
  buildModelEntries,
  extractCatalogAndCosts,
  generateOpencodeModels,
  outputLimitFor,
  parseModelsMd,
  toConfigKey,
  type CatalogEntry,
  type CostEntry,
} from "../../scripts/sync-models.ts"

const SAMPLE_MD = `# Command Code Models

| Id (use EXACTLY this) | Name | Context | Efforts | $/1M in/out · cache read | Min plan | Best for |
|---|---|---|---|---|---|---|
| \`deepseek/deepseek-v4-flash\` | DeepSeek V4 Flash (latest) | 1M | high, max | $0.15/$0.6 · cache $0.003 | Go and above | fast reasoning |
| \`claude-sonnet-4-6\` | Claude Sonnet 4.6 | 1M | low, medium | $3/$15 · cache $0.3 (write $3.75) | Pro and above | balanced |
| \`zai-org/GLM-5.1\` | GLM-5.1 | — | — | $1.4/$4.4 · cache $0.26 | Go and above | autonomous |
| \`poolside/laguna-s-2.1-free\` | Laguna S 2.1 | 256K | — | $0/$0 · cache $0 | Go and above | free |
`

const SAMPLE_BUNDLE = `var kL="anthropic",CL="openai",EL="vercel-ai-gateway",$L=EL,_L={[kL]:[{id:"anthropic:claude-sonnet-4-6",provider:"Anthropic",category:"premium",promptCost:3,completionCost:15,cacheWrite5mCost:3.75,cacheWrite1hCost:6,cacheHitCost:.3}],[EL]:[{id:"vercel-ai-gateway:deepseek/deepseek-v4-flash",provider:"Vercel",category:"opensource",promptCost:.15,completionCost:.6,cacheWrite5mCost:0,cacheWrite1hCost:0,cacheHitCost:.003}]};var FL="chatComplete",BT={SONNET_4_6:{id:"claude-sonnet-4-6",provider:kL,spec:FL,label:"Claude Sonnet 4.6",name:"Claude Sonnet 4.6",reasoning:!0,reasoningEfforts:["low","high"],contextWindow:1e6},DEEPSEEK_FLASH:{id:"deepseek/deepseek-v4-flash",provider:$L,spec:FL,label:"DeepSeek V4 Flash",name:"DeepSeek V4 Flash",reasoningEfforts:["high"],contextWindow:1e6},GLM:{id:"zai-org/GLM-5.1",provider:$L,spec:FL,label:"GLM-5.1",name:"GLM-5.1"},ALIAS_A:{id:"MiniMaxAI/MiniMax-M3-Free",provider:$L,spec:FL,label:"M3",name:"MiniMax M3"},ALIAS_B:{id:"minimax/minimax-m3-free",provider:$L,spec:FL,label:"M3",name:"MiniMax M3 free"}};`

test("parseModelsMd extracts id, context, cost and reasoning", () => {
  const md = parseModelsMd(SAMPLE_MD)
  expect(md.size).toBe(4)

  const flash = md.get("deepseek/deepseek-v4-flash")
  expect(flash?.context).toBe(1_000_000)
  expect(flash?.cost).toEqual({ input: 0.15, output: 0.6, cache_read: 0.003 })
  expect(flash?.reasoning).toBe(true)

  const sonnet = md.get("claude-sonnet-4-6")
  expect(sonnet?.cost).toEqual({ input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 })

  const glm = md.get("zai-org/GLM-5.1")
  expect(glm?.context).toBeUndefined()
  expect(glm?.reasoning).toBe(false)
  expect(glm?.cost).toEqual({ input: 1.4, output: 4.4, cache_read: 0.26 })

  const free = md.get("poolside/laguna-s-2.1-free")
  expect(free?.context).toBe(256_000)
  expect(free?.cost).toEqual({ input: 0, output: 0, cache_read: 0 })
})

test("extractCatalogAndCosts resolves minified provider aliases", () => {
  const { catalog, costs } = extractCatalogAndCosts(SAMPLE_BUNDLE)
  expect(catalog.map((m) => m.id)).toEqual([
    "claude-sonnet-4-6",
    "deepseek/deepseek-v4-flash",
    "zai-org/GLM-5.1",
    "MiniMaxAI/MiniMax-M3-Free",
    "minimax/minimax-m3-free",
  ])
  expect(catalog[0]?.provider).toBe("anthropic")
  expect(catalog[1]?.provider).toBe("vercel-ai-gateway")
  expect(catalog[0]?.reasoning).toBe(true)
  expect(costs.get("claude-sonnet-4-6")?.promptCost).toBe(3)
  expect(costs.get("deepseek/deepseek-v4-flash")?.cacheHitCost).toBe(0.003)
})

test("buildModelEntries prefers docs pricing and dedupes config keys", () => {
  const catalog: CatalogEntry[] = [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic", reasoning: true, contextWindow: 1_000_000 },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "vercel-ai-gateway", reasoningEfforts: ["high"], contextWindow: 1_000_000 },
    { id: "MiniMaxAI/MiniMax-M3-Free", name: "MiniMax M3", provider: "vercel-ai-gateway", contextWindow: 1_000_000 },
    { id: "minimax/minimax-m3-free", name: "MiniMax M3 free", provider: "vercel-ai-gateway", contextWindow: 1_000_000 },
  ]
  const costs = new Map<string, CostEntry>()
  const entries = buildModelEntries(catalog, costs, parseModelsMd(SAMPLE_MD))

  expect(entries).toHaveLength(3)
  expect(entries.map((e) => e.id)).not.toContain("minimax/minimax-m3-free")

  const claude = entries.find((e) => e.id === "claude-sonnet-4-6")
  expect(claude?.tier).toBe("premium")
  expect(claude?.cost).toEqual({ input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 })
  expect(claude?.limit.context).toBe(1_000_000)
  expect(claude?.limit.output).toBe(outputLimitFor("claude-sonnet-4-6"))

  const deepseek = entries.find((e) => e.id === "deepseek/deepseek-v4-flash")
  expect(deepseek?.tier).toBe("open-source")
  expect(deepseek?.reasoning).toBe(true)

  const unpriced = entries.find((e) => e.id === "MiniMaxAI/MiniMax-M3-Free")
  expect(unpriced?.cost).toEqual({ input: 0, output: 0 })
})

test("toConfigKey strips author prefix and lowercases", () => {
  expect(toConfigKey("deepseek/deepseek-v4-flash")).toBe("deepseek-v4-flash")
  expect(toConfigKey("claude-opus-5")).toBe("claude-opus-5")
  expect(toConfigKey("MiniMaxAI/MiniMax-M3-Free")).toBe("minimax-m3-free")
})

test("carries reasoning efforts and emits opencode variants", () => {
  const catalog: CatalogEntry[] = [
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "vercel-ai-gateway", reasoningEfforts: ["high", "max"], contextWindow: 1_000_000 },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic", reasoning: true, contextWindow: 1_000_000 },
  ]
  const entries = buildModelEntries(catalog, new Map<string, CostEntry>(), new Map())

  const deepseek = entries.find((e) => e.id === "deepseek/deepseek-v4-flash")
  expect(deepseek?.reasoning_efforts).toEqual(["high", "max"])
  const claude = entries.find((e) => e.id === "claude-sonnet-4-6")
  expect(claude?.reasoning_efforts).toBeUndefined()

  const models = generateOpencodeModels(entries)
  const deepseekModel = models["deepseek-v4-flash"] as Record<string, unknown>
  expect(deepseekModel.variants).toEqual({
    high: { reasoningEffort: "high" },
    max: { reasoningEffort: "max" },
  })
  const claudeModel = models["claude-sonnet-4-6"] as Record<string, unknown>
  expect(claudeModel.variants).toBeUndefined()
})
