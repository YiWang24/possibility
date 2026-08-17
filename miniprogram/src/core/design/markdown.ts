/**
 * 行内 markdown 切段 —— 对应 iOS `ChatView.markdownText`
 * （`AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)`）。
 *
 * 只处理 `**加粗**`，保留换行。AI 回复里唯一会用到的行内语法就是加粗
 * （见 `goldenReply` 与 system prompt），不需要完整的 markdown 解析器。
 *
 * 为什么不用 `rich-text` 组件：那需要把文本拼成 HTML 字符串，而 AI 输出是不可信内容 ——
 * 拼 HTML 就得自己做转义，漏一处就是注入。切成段用 `<text>` 渲染没有这个问题，
 * 小程序会把每段当纯文本处理。
 */

export interface MarkdownSegment {
  text: string
  bold: boolean
}

/** 把含 `**加粗**` 的文本切成段。未闭合的 `**` 原样保留（流式输出中很常见）。 */
export function parseInlineMarkdown(raw: string): MarkdownSegment[] {
  if (!raw) return []

  const segments: MarkdownSegment[] = []
  let rest = raw

  for (;;) {
    const open = rest.indexOf('**')
    if (open === -1) break

    const close = rest.indexOf('**', open + 2)
    // 未闭合：打字机正在吐字，后半段还没到。原样留着，下一帧自然会闭合。
    if (close === -1) break

    if (open > 0) segments.push({ text: rest.slice(0, open), bold: false })
    const inner = rest.slice(open + 2, close)
    if (inner) segments.push({ text: inner, bold: true })
    rest = rest.slice(close + 2)
  }

  if (rest) segments.push({ text: rest, bold: false })
  return segments
}
