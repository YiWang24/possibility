// 真实 Azure AI Speech 冒烟测试。
//
// diary_v2_test.ts 里的转写用例全部注入 mock fetch：它们能证明"我们发出的请求长
// 什么样"，但无法证明"Azure 是否接受这个请求"。上游契约漂移、密钥失效、区域端点
// 写错、multipart 字段缺少 Content-Type 被拒——这些故障在 mock 下 100% 通过，却会
// 让线上每一条语音日记都以不可重试的 TRANSCRIPTION_CONFIGURATION_ERROR 收场。
//
// 因此这里直接调用生产函数 transcribeDiaryAudio() 打真实端点。没有配置密钥时整组
// 跳过，所以本地开发和 CI 不会因为缺密钥变红。
//
// 运行：
//   doppler run --project possibility --config prd -- \
//     deno test --allow-net --allow-env --allow-read \
//       --config supabase/functions/deno.json \
//       supabase/functions/tests/transcription_live_test.ts

import {
  transcribeDiaryAudio,
  TranscriptionError,
} from "../_shared/transcription.ts";

// 仓库默认的 `npm run backend:check` 不带 --allow-env，读环境变量会直接抛
// NotCapable 并让整个测试运行器失败。这组用例本就该在那种场景下静默跳过，
// 所以权限缺失和密钥缺失一样，都退化成"没有配置"。
function readEnv(name: string): string {
  try {
    return Deno.env.get(name) ?? "";
  } catch {
    return "";
  }
}

const apiKey = readEnv("AZURE_SPEECH_KEY");
const endpoint = readEnv("AZURE_SPEECH_ENDPOINT");
// 未配置密钥时跳过，而不是失败：这组用例是上线前的真实性检查，不是单元测试。
const skip = !apiKey || !endpoint;

const apiVersion = readEnv("AZURE_SPEECH_API_VERSION") || "2025-10-15";
const locales = (readEnv("AZURE_SPEECH_LOCALES") || "zh-CN,en-US")
  .split(",")
  .map((locale) => locale.trim())
  .filter(Boolean);

const liveOptions = { apiKey, endpoint, apiVersion, locales };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function sampleAudio(): Promise<Blob> {
  const bytes = await Deno.readFile(
    new URL("./fixtures/diary-sample-zh.wav", import.meta.url),
  );
  return new Blob([bytes], { type: "audio/wav" });
}

Deno.test({
  name: "[live] Azure 转写真实中文录音并返回可用文本",
  ignore: skip,
  fn: async () => {
    const result = await transcribeDiaryAudio(
      await sampleAudio(),
      "diary-sample-zh.wav",
      "audio/wav",
      liveOptions,
    );

    // 不断言逐字相等：识别结果会随模型版本微调。断言"听懂了这句话的主干"即可，
    // 既能抓住端点/密钥/契约故障，又不会因为一个标点变化就误报。
    assert(
      result.text.includes("语音日记"),
      `转写结果缺少关键词「语音日记」：${result.text}`,
    );
    assert(
      result.language === "zh-CN",
      `期望识别为 zh-CN，实际 ${result.language}`,
    );
    assert(result.provider === "azure", "provider 应为 azure");
    assert(
      result.model === `fast-transcription-${apiVersion}`,
      `model 应记录实际 api-version，实际 ${result.model}`,
    );
  },
});

Deno.test({
  name: "[live] 无人声录音被判定为 TRANSCRIPTION_EMPTY 且不可重试",
  ignore: skip,
  fn: async () => {
    // 一秒静音（16kHz / 单声道 / 16bit PCM）。用户对着静音环境点了录音就是这种输入，
    // 它必须走"提示用户重录"而不是无限重试烧配额。
    const sampleRate = 16_000;
    const samples = sampleRate;
    const dataBytes = samples * 2;
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);
    const ascii = (offset: number, text: string) => {
      for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index));
      }
    };
    ascii(0, "RIFF");
    view.setUint32(4, 36 + dataBytes, true);
    ascii(8, "WAVEfmt ");
    view.setUint32(16, 16, true); // fmt chunk 长度
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 单声道
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    ascii(36, "data");
    view.setUint32(40, dataBytes, true);
    // data 段保持全零 = 静音。

    try {
      const result = await transcribeDiaryAudio(
        new Blob([buffer], { type: "audio/wav" }),
        "silence.wav",
        "audio/wav",
        liveOptions,
      );
      throw new Error(`静音录音本应失败，却返回了：${result.text}`);
    } catch (error) {
      assert(
        error instanceof TranscriptionError,
        `期望 TranscriptionError，实际 ${error}`,
      );
      const failure = error as TranscriptionError;
      assert(
        failure.code === "TRANSCRIPTION_EMPTY",
        `期望 TRANSCRIPTION_EMPTY，实际 ${failure.code}`,
      );
      assert(
        !failure.retryable,
        "静音是终态失败，重试只会重复烧配额",
      );
    }
  },
});

Deno.test({
  name: "[live] 错误密钥返回不可重试的配置错误",
  ignore: skip,
  fn: async () => {
    // 密钥失效必须立刻停下来报警，而不是被当成瞬时故障重试三次。
    try {
      await transcribeDiaryAudio(
        await sampleAudio(),
        "diary-sample-zh.wav",
        "audio/wav",
        { ...liveOptions, apiKey: "0".repeat(32) },
      );
      throw new Error("错误密钥本应失败");
    } catch (error) {
      assert(
        error instanceof TranscriptionError,
        `期望 TranscriptionError，实际 ${error}`,
      );
      const failure = error as TranscriptionError;
      assert(
        failure.code === "TRANSCRIPTION_CONFIGURATION_ERROR",
        `期望 TRANSCRIPTION_CONFIGURATION_ERROR，实际 ${failure.code}`,
      );
      assert(!failure.retryable, "鉴权失败不该自动重试");
    }
  },
});
