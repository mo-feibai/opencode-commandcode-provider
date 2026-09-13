# commandcode-go-opencode-provider

[Command Code](https://commandcode.ai) API provider for [opencode](https://opencode.ai). Use Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, GLM, MiniMax, Step, and other models through a single API key.

## Quick Start

### 1. Install

```bash
opencode plugin commandcode-go-opencode-provider
```

This installs the provider and registers all available models automatically.

### 2. Connect

Run `/connect` in opencode, search for **Command Code**, and enter your API key:

```
/connect
```

### 3. Select a model

Run `/models` to pick from available models:

```
/models
```

## Manual Configuration

If you prefer to configure manually, add this to your `opencode.json`:

```json
{
  "plugin": ["commandcode-go-opencode-provider/server"],
  "provider": {
    "commandcode": {
      "npm": "commandcode-go-opencode-provider",
      "name": "Command Code",
      "env": ["COMMANDCODE_API_KEY"]
    }
  },
  "model": "commandcode/deepseek-v4-flash"
}
```

The plugin auto-registers models from [`models.json`](./models.json) at startup. You only need the `provider.commandcode` block — no need to list individual models.

### Environment Variable

Set `COMMANDCODE_API_KEY` instead of using `/connect`:

```bash
COMMANDCODE_API_KEY=your-key opencode
```

## Available Models

| Model ID | Name | Tier | Reasoning | Context |
|---|---|---|---|---|
| `claude-fable-5`                           | Claude Fable 5              | premium      | yes | 1M     |
| `claude-fable-5-1`                         | Claude Fable 5.1            | premium      | yes | 1M     |
| `claude-haiku-4-5-20251001`                | Claude Haiku 4.5            | premium      | no  | 200K   |
| `claude-opus-4-7`                          | Claude Opus 4.7             | premium      | yes | 1M     |
| `claude-opus-4-8`                          | Claude Opus 4.8             | premium      | yes | 1M     |
| `claude-opus-5`                            | Claude Opus 5               | premium      | yes | 1M     |
| `claude-sonnet-4-6`                        | Claude Sonnet 4.6           | premium      | yes | 1M     |
| `claude-sonnet-5`                          | Claude Sonnet 5             | premium      | yes | 1M     |
| `gpt-5.3-codex`                            | GPT-5.3 Codex               | premium      | yes | 400K   |
| `gpt-5.4`                                  | GPT-5.4                     | premium      | yes | 400K   |
| `gpt-5.4-mini`                             | GPT-5.4 Mini                | premium      | yes | 400K   |
| `gpt-5.5`                                  | GPT-5.5                     | premium      | yes | 400K   |
| `gpt-5.6-luna`                             | GPT-5.6 Luna                | premium      | yes | 1M     |
| `gpt-5.6-sol`                              | GPT-5.6 Sol                 | premium      | yes | 1M     |
| `gpt-5.6-terra`                            | GPT-5.6 Terra               | premium      | yes | 1M     |
| `gpt-6-astra`                              | GPT-6 Astra                 | premium      | yes | 1M     |
| `deepseek/deepseek-v4-flash`               | DeepSeek V4 Flash (latest)  | open-source  | yes | 1M     |
| `deepseek/deepseek-v4-flash-fast`          | DeepSeek V4 Flash Fast      | open-source  | yes | 1M     |
| `deepseek/deepseek-v4-flash-vision-exp`    | DeepSeek V4 Flash Vision (exp) | open-source  | yes | 1M     |
| `deepseek/deepseek-v4-pro`                 | DeepSeek V4 Pro (latest)    | open-source  | yes | 1M     |
| `deepseek/deepseek-v4.1-flash`             | DeepSeek V4.1 Flash         | open-source  | yes | 1M     |
| `sakana/fugu-ultra`                        | Fugu Ultra                  | open-source  | yes | 1M     |
| `google/gemini-3.1-flash-lite`             | Gemini 3.1 Flash Lite       | open-source  | yes | 1M     |
| `google/gemini-3.5-flash`                  | Gemini 3.5 Flash            | open-source  | yes | 1M     |
| `google/gemini-3.5-flash-lite`             | Gemini 3.5 Flash Lite       | open-source  | yes | 1M     |
| `google/gemini-3.6-flash`                  | Gemini 3.6 Flash            | open-source  | yes | 1M     |
| `google/gemini-3.7-flash`                  | Gemini 3.7 Flash            | open-source  | yes | 1M     |
| `google/gemini-3.8-flash`                  | Gemini 3.8 Flash            | open-source  | yes | 1M     |
| `zai-org/GLM-5`                            | GLM-5                       | open-source  | no  | 200K   |
| `zai-org/GLM-5.1`                          | GLM-5.1                     | open-source  | no  | 200K   |
| `zai-org/GLM-5.2`                          | GLM-5.2                     | open-source  | yes | 1M     |
| `zai-org/GLM-5.2-Fast`                     | GLM-5.2 Fast                | open-source  | no  | 1M     |
| `zai-org/GLM-5.3`                          | GLM-5.3                     | open-source  | yes | 1M     |
| `z-ai/glm-5.3-flash`                       | GLM-5.3 Flash               | open-source  | yes | 1M     |
| `xai/grok-4.5`                             | Grok 4.5                    | open-source  | yes | 500K   |
| `xai/grok-4.6`                             | Grok 4.6                    | open-source  | yes | 500K   |
| `thinkingmachines/inkling`                 | Inkling                     | open-source  | yes | 256K   |
| `thinkingmachines/inkling-small`           | Inkling Small               | open-source  | yes | 1M     |
| `moonshotai/Kimi-K2.5`                     | Kimi K2.5                   | open-source  | no  | 256K   |
| `moonshotai/Kimi-K2.6`                     | Kimi K2.6                   | open-source  | no  | 256K   |
| `moonshotai/Kimi-K2.7-Code`                | Kimi K2.7 Code              | open-source  | yes | 256K   |
| `moonshotai/Kimi-K2.7-Code-Highspeed`      | Kimi K2.7 Code HighSpeed    | open-source  | yes | 262K   |
| `moonshotai/Kimi-K3`                       | Kimi K3                     | open-source  | yes | 1M     |
| `poolside/laguna-s-2.1-free`               | Laguna S 2.1                | open-source  | yes | 256K   |
| `inclusionai/ling-3.0-flash-free`          | Ling 3.0 Flash              | open-source  | yes | 256K   |
| `inclusionai/ling-3.0-flash-sante:free`    | Ling 3.0 Flash Sante        | open-source  | yes | 262K   |
| `meituan/LongCat-2.0:free`                 | LongCat 2.0                 | open-source  | yes | 1M     |
| `xiaomi/mimo-v2.5`                         | MiMo V2.5                   | open-source  | no  | 1M     |
| `xiaomi/mimo-v2.5-pro`                     | MiMo V2.5 Pro               | open-source  | no  | 1M     |
| `MiniMaxAI/MiniMax-M2.5`                   | MiniMax M2.5                | open-source  | no  | 200K   |
| `MiniMaxAI/MiniMax-M2.7`                   | MiniMax M2.7                | open-source  | no  | 200K   |
| `minimax/minimax-m2.7-free`                | MiniMax M2.7 (Free)         | open-source  | no  | 197K   |
| `MiniMaxAI/MiniMax-M3-Free`                | MiniMax M3                  | open-source  | yes | 1M     |
| `MiniMaxAI/MiniMax-M3`                     | MiniMax M3                  | open-source  | yes | 1M     |
| `meta/muse-spark-1.1`                      | Muse Spark 1.1              | open-source  | yes | 1M     |
| `meta/muse-spark-1.2`                      | Muse Spark 1.2              | open-source  | yes | 1M     |
| `meta/muse-spark-1.2-contributor`          | Muse Spark 1.2 Contributor  | open-source  | yes | 1M     |
| `meta/muse-spark-1.3`                      | Muse Spark 1.3              | open-source  | yes | 1M     |
| `meta/muse-spark-1.3-contributor`          | Muse Spark 1.3 Contributor  | open-source  | yes | 1M     |
| `nvidia/nemotron-3-ultra-550b-a55b`        | Nemotron 3 Ultra            | open-source  | yes | 1M     |
| `Qwen/Qwen3.6-Max-Preview`                 | Qwen 3.6 Max Preview        | open-source  | yes | 200K   |
| `Qwen/Qwen3.6-Plus`                        | Qwen 3.6 Plus               | open-source  | yes | 200K   |
| `Qwen/Qwen3.7-Flash`                       | Qwen 3.7 Flash              | open-source  | yes | 1M     |
| `Qwen/Qwen3.7-Max`                         | Qwen 3.7 Max                | open-source  | yes | 1M     |
| `Qwen/Qwen3.7-Plus`                        | Qwen 3.7 Plus               | open-source  | yes | 1M     |
| `Qwen/Qwen3.8-27B`                         | Qwen 3.8 27B                | open-source  | yes | 262K   |
| `Qwen/Qwen3.8-Flash`                       | Qwen 3.8 Flash              | open-source  | yes | 1M     |
| `Qwen/Qwen3.8-Max`                         | Qwen 3.8 Max                | open-source  | yes | 1M     |
| `Qwen/Qwen3.8-Max-0902`                    | Qwen 3.8 Max 0902           | open-source  | yes | 1M     |
| `stepfun/Step-3.5-Flash`                   | Step 3.5 Flash              | open-source  | yes | 1M     |
| `stepfun/Step-3.7-Flash`                   | Step 3.7 Flash              | open-source  | yes | 256K   |
| `tencent/hy3-paid`                         | Tencent Hy3                 | open-source  | yes | 262K   |
| `tencent/Hy3`                              | Tencent Hy3 (Free)          | open-source  | yes | 262K   |
| `tencent/hy4-preview`                      | Tencent Hy4 Preview         | open-source  | yes | 1M     |

Full model list is maintained in [`models.json`](./models.json). Run `bun run sync` to refresh from the latest Command Code CLI release on npm.

## Development

```bash
git clone https://github.com/mo-feibai/opencode-commandcode-provider.git
cd opencode-commandcode-provider
bun install
```

For local testing, create `opencode.local.json` (gitignored) with `file://` paths:

```json
{
  "plugin": ["file:///path/to/commandcode-go-opencode-provider/server"],
  "provider": {
    "commandcode": {
      "npm": "file:///path/to/commandcode-go-opencode-provider",
      "name": "Command Code (local)",
      "env": ["COMMANDCODE_API_KEY"]
    }
  }
}
```

Run `opencode --config opencode.local.json` to test with your local build.

### Sync Models

```bash
bun run sync              # refresh models.json + src/version.ts from the latest command-code npm release
bun run sync:global       # same, and also write the model list to ~/.config/opencode/opencode.jsonc
```

`sync` downloads the latest [`command-code`](https://www.npmjs.com/package/command-code) release, extracts the authoritative model catalog from the CLI bundle, and merges advertised pricing/context from the bundled `models.md` docs. It also records the CLI version in `src/version.ts`, which is sent as the required `x-command-code-version` header.

Keep the provider fresh by re-running `sync` after Command Code ships new models or a new CLI version.

## Maintenance

This repository is a maintained fork of [`brent-weatherall/opencode-commandcode-provider`](https://github.com/brent-weatherall/opencode-commandcode-provider), kept in sync with current Command Code releases.

## License

MIT
