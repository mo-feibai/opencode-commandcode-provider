import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { execSync } from "child_process"

const PROJECT_ROOT = join(import.meta.dir, "..")
const MODELS_JSON = join(PROJECT_ROOT, "models.json")
const VERSION_TS = join(PROJECT_ROOT, "src", "version.ts")
const GLOBAL_CONFIG = join(homedir(), ".config", "opencode", "opencode.jsonc")
const NPM_PACKAGE = "command-code"
const TMP_DIR = join("/tmp", "cc-model-sync")

export interface ModelEntry {
  id: string
  name: string
  tier: "premium" | "open-source"
  reasoning: boolean
  /** Reasoning efforts the model supports (e.g. ["low","medium","high"]). */
  reasoning_efforts?: string[]
  tool_call: boolean
  cost: { input: number; output: number; cache_read?: number; cache_write?: number }
  limit: { context: number; output: number }
}

export interface CostEntry {
  id: string
  provider: string
  category: string
  promptCost: number
  completionCost: number
  cacheWrite5mCost: number
  cacheWrite1hCost: number
  cacheHitCost: number
}

export interface CatalogEntry {
  id: string
  name: string
  provider: string
  spec?: string
  reasoning?: boolean
  reasoningEfforts?: string[]
  contextWindow?: number
}

export interface MdEntry {
  id: string
  name: string
  context?: number
  reasoning: boolean
  cost?: { input: number; output: number; cache_read?: number; cache_write?: number }
}

function tierFor(id: string): "premium" | "open-source" {
  if (id.startsWith("claude-") || id.startsWith("gpt-")) return "premium"
  return "open-source"
}

const FALLBACK_COSTS: Record<string, { input: number; output: number; cache_read?: number; cache_write?: number }> = {
  "deepseek/deepseek-v4-pro": { input: 0.66, output: 1.98, cache_read: 0.022 },
  "deepseek/deepseek-v4-flash": { input: 0.15, output: 0.6, cache_read: 0.003 },
}

const DEFAULT_OUTPUT_LIMIT = 65536

export function outputLimitFor(id: string): number {
  if (id.startsWith("deepseek/")) return 384000
  if (id.startsWith("claude-")) return 32000
  if (id.startsWith("gpt-")) return 128000
  if (id.startsWith("google/")) return 65536
  return 131072
}

// --- Markdown catalog (dist/bundled/.../reference/models.md) -----------------

function parseContextValue(raw: string): number | undefined {
  const m = raw.match(/([\d.]+)\s*([MK])?/i)
  if (!m || raw.trim() === "—" || raw.trim() === "-") return undefined
  const value = Number(m[1])
  if (!Number.isFinite(value)) return undefined
  const unit = (m[2] ?? "").toUpperCase()
  if (unit === "M") return Math.round(value * 1_000_000)
  if (unit === "K") return Math.round(value * 1_000)
  return Math.round(value)
}

function parseCostValue(raw: string): MdEntry["cost"] {
  const price = raw.match(/\$([\d.]+)\s*\/\s*\$([\d.]+)/)
  if (!price) return undefined
  const cost: { input: number; output: number; cache_read?: number; cache_write?: number } = {
    input: Number(price[1]),
    output: Number(price[2]),
  }
  const cache = raw.match(/cache\s*\$([\d.]+)/)
  if (cache) cost.cache_read = Number(cache[1])
  const write = raw.match(/write\s*\$([\d.]+)/)
  if (write) cost.cache_write = Number(write[1])
  return cost
}

export function parseModelsMd(md: string): Map<string, MdEntry> {
  const map = new Map<string, MdEntry>()
  for (const line of md.split("\n")) {
    const cells = line.split("|").map((c) => c.trim())
    if (cells.length < 8) continue
    const idMatch = cells[1]?.match(/^`([^`]+)`$/)
    if (!idMatch) continue
    const id = idMatch[1] ?? ""
    const name = cells[2] ?? id
    const context = parseContextValue(cells[3] ?? "")
    const efforts = cells[4] ?? ""
    const cost = parseCostValue(cells[5] ?? "")
    map.set(id, { id, name, context, reasoning: efforts !== "" && efforts !== "—", cost })
  }
  return map
}

// --- Minified bundle extraction ---------------------------------------------

function matchBrace(source: string, braceStart: number): number {
  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    const c = source[i]
    if (c === '"' || c === "'" || c === "`") {
      const quote = c
      i++
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue }
        if (source[i] === quote) break
        i++
      }
      continue
    }
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  throw new Error("Unbalanced braces while scanning bundle")
}

function enclosingObjectStart(source: string, fromIdx: number): number {
  let depth = 0
  for (let i = fromIdx; i >= 0; i--) {
    const c = source[i]
    if (c === "}") depth++
    else if (c === "{") {
      if (depth === 0) return i
      depth--
    }
  }
  throw new Error("Could not find enclosing object")
}

function findAssignedObjectFromIndex(source: string, idx: number): { name: string; start: number; end: number } {
  let inside = idx
  for (let guard = 0; guard < 50; guard++) {
    const braceStart = enclosingObjectStart(source, inside)
    const before = source.slice(Math.max(0, braceStart - 100), braceStart)
    const m = before.match(/([A-Za-z_$][\w$]*)\s*=\s*$/)
    if (m && m[1]) return { name: m[1], start: braceStart, end: matchBrace(source, braceStart) }
    inside = braceStart - 1
  }
  throw new Error("Could not find assigned object")
}

function findRichestAssignedObject(source: string, marker: string): { name: string; start: number; end: number } {
  const counts = new Map<number, number>()
  let i = -1
  while ((i = source.indexOf(marker, i + 1)) !== -1) {
    try {
      const obj = findAssignedObjectFromIndex(source, i)
      counts.set(obj.start, (counts.get(obj.start) ?? 0) + 1)
    } catch {
      // marker not inside an assigned object; skip
    }
  }
  let bestStart = -1
  let bestCount = 0
  for (const [start, count] of counts) {
    if (count > bestCount) { bestStart = start; bestCount = count }
  }
  if (bestStart < 0) throw new Error(`Could not locate object for marker ${marker}`)
  const before = source.slice(Math.max(0, bestStart - 100), bestStart)
  const nameMatch = before.match(/([A-Za-z_$][\w$]*)\s*=\s*$/)
  if (!nameMatch || !nameMatch[1]) throw new Error(`Could not determine variable name for marker ${marker}`)
  return { name: nameMatch[1], start: bestStart, end: matchBrace(source, bestStart) }
}

function splitTopLevel(source: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let inStr: string | null = null
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (inStr) {
      if (c === "\\") { i++ }
      else if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue }
    if (c === "{" || c === "(" || c === "[") depth++
    else if (c === "}" || c === ")" || c === "]") depth--
    else if (c === ";" && depth === 0) { parts.push(source.slice(start, i)); start = i + 1 }
  }
  parts.push(source.slice(start))
  return parts
}

function statementStartBefore(source: string, idx: number): number {
  const varIdx = source.lastIndexOf("var ", idx)
  const semiIdx = source.lastIndexOf(";", idx)
  return varIdx > semiIdx ? varIdx : semiIdx + 1
}

export function extractCatalogAndCosts(source: string): {
  catalog: CatalogEntry[]
  costs: Map<string, CostEntry>
} {
  const catalogObj = findRichestAssignedObject(source, "contextWindow:")
  const costObj = findRichestAssignedObject(source, "promptCost:")

  const regionStart = Math.min(catalogObj.start, costObj.start)
  const stmtStart = statementStartBefore(source, regionStart)
  const region = source.slice(stmtStart, catalogObj.end + 1)

  const decls = splitTopLevel(region).filter((p) => /^\s*var\s/.test(p)).join(";")
  const fn = new Function(decls + `;return { catalog: ${catalogObj.name}, costs: ${costObj.name} }`) as () => {
    catalog: Record<string, CatalogEntry>
    costs: Record<string, CostEntry[]>
  }
  const { catalog, costs } = fn()

  const costMap = new Map<string, CostEntry>()
  for (const arr of Object.values(costs)) {
    for (const entry of arr) {
      const colonIdx = entry.id.indexOf(":")
      const bareId = colonIdx >= 0 ? entry.id.slice(colonIdx + 1) : entry.id
      costMap.set(bareId, entry)
    }
  }

  return { catalog: Object.values(catalog), costs: costMap }
}

// --- Entry construction -----------------------------------------------------

export function toConfigKey(id: string): string {
  const slashIdx = id.indexOf("/")
  const short = slashIdx >= 0 ? id.slice(slashIdx + 1) : id
  return short.toLowerCase()
}

export function buildModelEntries(
  catalog: CatalogEntry[],
  costMap: Map<string, CostEntry>,
  md: Map<string, MdEntry>,
): ModelEntry[] {
  const entries: ModelEntry[] = []
  for (const model of catalog) {
    const mdEntry = md.get(model.id)

    const bundleCost = costMap.get(model.id)
    let cost: ModelEntry["cost"]
    if (mdEntry?.cost) {
      cost = mdEntry.cost
    } else if (bundleCost) {
      cost = { input: bundleCost.promptCost, output: bundleCost.completionCost }
      if (bundleCost.cacheHitCost > 0) cost.cache_read = bundleCost.cacheHitCost
      if (bundleCost.cacheWrite5mCost > 0) cost.cache_write = bundleCost.cacheWrite5mCost
    } else {
      cost = FALLBACK_COSTS[model.id] ?? { input: 0, output: 0 }
    }

    const context = model.contextWindow ?? mdEntry?.context ?? 200000
    const reasoning =
      Boolean(model.reasoning) ||
      (model.reasoningEfforts?.length ?? 0) > 0 ||
      Boolean(mdEntry?.reasoning)

    entries.push({
      id: model.id,
      name: model.name,
      tier: tierFor(model.id),
      reasoning,
      ...(model.reasoningEfforts?.length ? { reasoning_efforts: model.reasoningEfforts } : {}),
      tool_call: true,
      cost,
      limit: { context, output: outputLimitFor(model.id) },
    })
  }

  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = toConfigKey(entry.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function generateOpencodeModels(entries: ModelEntry[]): Record<string, unknown> {
  const models: Record<string, unknown> = {}
  for (const entry of entries) {
    const key = toConfigKey(entry.id)
    const costObj: Record<string, number> = { input: entry.cost.input, output: entry.cost.output }
    if (entry.cost.cache_read !== undefined) costObj.cache_read = entry.cost.cache_read
    if (entry.cost.cache_write !== undefined) costObj.cache_write = entry.cost.cache_write

    models[key] = {
      id: entry.id,
      name: entry.name,
      reasoning: entry.reasoning,
      tool_call: entry.tool_call,
      cost: costObj,
      limit: entry.limit,
    }

    if (entry.reasoning_efforts?.length) {
      const variants: Record<string, unknown> = {}
      for (const effort of entry.reasoning_efforts) {
        variants[effort] = { reasoningEffort: effort }
      }
      ;(models[key] as Record<string, unknown>).variants = variants
    }
  }
  return models
}

// --- Fetching ---------------------------------------------------------------

interface BundleData {
  source: string
  modelsMd: string | null
  version: string
}

async function fetchLatestBundle(): Promise<BundleData> {
  console.log(`Fetching latest ${NPM_PACKAGE} metadata...`)
  const metaResp = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`)
  if (!metaResp.ok) throw new Error(`npm registry returned ${metaResp.status}`)
  const meta = (await metaResp.json()) as { version: string; dist: { tarball: string } }
  const version = meta.version
  const tarball = meta.dist.tarball
  console.log(`  Latest version: ${version}`)

  rmSync(TMP_DIR, { recursive: true, force: true })
  mkdirSync(TMP_DIR, { recursive: true })
  const tgzPath = join(TMP_DIR, `${NPM_PACKAGE}.tgz`)

  console.log("Downloading tarball...")
  const tarballResp = await fetch(tarball)
  if (!tarballResp.ok) throw new Error(`tarball download returned ${tarballResp.status}`)
  writeFileSync(tgzPath, Buffer.from(await tarballResp.arrayBuffer()))

  console.log("Extracting...")
  execSync(`tar -xzf "${tgzPath}" -C "${TMP_DIR}"`, { stdio: "pipe" })

  const candidates = ["dist/cli.mjs", "dist/index.mjs"]
  let source: string | null = null
  for (const candidate of candidates) {
    const p = join(TMP_DIR, "package", candidate)
    if (existsSync(p)) {
      const content = readFileSync(p, "utf-8")
      if (content.includes("contextWindow:") && content.includes("promptCost:")) {
        source = content
        break
      }
    }
  }
  if (!source) throw new Error("Could not locate model catalog in CLI bundle")

  const mdPath = join(TMP_DIR, "package", "dist", "bundled", "command-code-knowledge", "reference", "models.md")
  const modelsMd = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : null
  if (!modelsMd) console.warn("  models.md not found; costs fall back to bundle data only")

  rmSync(TMP_DIR, { recursive: true, force: true })

  return { source, modelsMd, version }
}

// --- Global config ----------------------------------------------------------

function stripJsonc(input: string): string {
  let out = ""
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === '"') {
      const start = i
      i++
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\") i++
        i++
      }
      i++
      out += input.slice(start, i)
    } else if (ch === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++
    } else if (ch === "/" && input[i + 1] === "*") {
      i += 2
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++
      i += 2
    } else {
      out += ch
      i++
    }
  }
  return out.replace(/,\s*([}\]])/g, "$1")
}

function updateGlobalConfig(modelsObj: Record<string, unknown>) {
  if (!existsSync(GLOBAL_CONFIG)) {
    console.log(`  Global config not found at ${GLOBAL_CONFIG}, skipping`)
    return
  }

  let config: Record<string, unknown>
  try {
    config = JSON.parse(stripJsonc(readFileSync(GLOBAL_CONFIG, "utf-8")))
  } catch {
    console.error("  Failed to parse global config after stripping comments")
    return
  }

  const provider = (config.provider as Record<string, Record<string, unknown>>) ?? {}
  const commandcode = provider.commandcode ?? {
    npm: "commandcode-go-opencode-provider",
    name: "Command Code",
    env: ["COMMANDCODE_API_KEY"],
  }
  commandcode.models = modelsObj
  provider.commandcode = commandcode
  config.provider = provider

  writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2) + "\n", "utf-8")
  console.log(`  Updated ${GLOBAL_CONFIG}`)
}

// --- Main -------------------------------------------------------------------

export async function main() {
  const args = process.argv.slice(2)
  const shouldUpdateGlobal = args.includes("--update-global")

  const { source, modelsMd, version } = await fetchLatestBundle()
  console.log(`Read CLI bundle v${version} (${(source.length / 1024).toFixed(0)} KB)`)

  console.log("Extracting model catalog and costs...")
  const { catalog, costs } = extractCatalogAndCosts(source)
  console.log(`  Found ${catalog.length} catalog models, ${costs.size} cost entries`)

  const md = modelsMd ? parseModelsMd(modelsMd) : new Map<string, MdEntry>()
  console.log(`  Parsed ${md.size} models from docs table`)

  const entries = buildModelEntries(catalog, costs, md)
  entries.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === "premium" ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  console.log(`Writing ${MODELS_JSON} with ${entries.length} models...`)
  writeFileSync(MODELS_JSON, JSON.stringify(entries, null, 2) + "\n", "utf-8")

  console.log(`Writing ${VERSION_TS} with version ${version}...`)
  writeFileSync(
    VERSION_TS,
    `// Auto-generated by scripts/sync-models.ts — do not edit manually\nexport const COMMAND_CODE_VERSION = ${JSON.stringify(version)}\n`,
    "utf-8",
  )

  if (shouldUpdateGlobal) {
    console.log("Updating global config...")
    updateGlobalConfig(generateOpencodeModels(entries))
  }

  const unpriced = entries.filter((e) => e.cost.input === 0 && e.cost.output === 0)
  console.log(`\nModel list (${entries.length}):`)
  for (const entry of entries) {
    const cost = `$${entry.cost.input}/$${entry.cost.output}`
    console.log(`  ${entry.tier.padEnd(12)} ${entry.id.padEnd(42)} ${entry.name.padEnd(32)} ${cost}`)
  }
  if (unpriced.length > 0) {
    console.log(`\nNote: ${unpriced.length} model(s) have no advertised price (shown as $0): ${unpriced.map((e) => e.id).join(", ")}`)
  }
  if (!shouldUpdateGlobal) {
    console.log(`\nRun with --update-global to update ${GLOBAL_CONFIG}`)
  }
  console.log("\nDone.")
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
