/**
 * 推演「相似旅人推荐」后处理：模型可能返回重复、越界或不存在的旅人 id。
 * 此处统一去重、过滤为真实存在的 id，并截断到最多 maxItems 个，
 * 保证前端拿到的推荐 id 都能查到对应旅人。纯函数、可单测。
 */
export function filterRecommendedTravelerIds(
  ids: number[],
  validIds: Set<number>,
  maxItems = 3,
): number[] {
  return [...new Set(ids)]
    .filter((id) => validIds.has(id))
    .slice(0, maxItems);
}
