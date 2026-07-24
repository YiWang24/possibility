#include <metal_stdlib>
using namespace metal;

// 熔岩灯 metaball 场（移植自 lucia-gomez/lava-lamp 的 WebGL fragment shader）：
// 对每个像素累加所有 blob 的 r²/d²，场强超过阈值即为熔岩；
// 颜色沿垂直方向在 color1(顶) 与 color2(底) 之间渐变，
// 并在阈值附近用 smoothstep 做柔边 + 场强提亮，避免硬切边。
//
// blobs 布局：[x0, y0, r0, x1, y1, r1, ...]（视图本地坐标，pt）
[[ stitchable ]] half4 lavaLamp(float2 position, half4 currentColor,
                                float2 size,
                                device const float *blobs, int count,
                                half4 color1, half4 color2,
                                float threshold) {
    float sum = 0.0;
    int n = count / 3;
    for (int i = 0; i < n; i++) {
        float dx = blobs[i * 3]     - position.x;
        float dy = blobs[i * 3 + 1] - position.y;
        float r  = blobs[i * 3 + 2];
        sum += (r * r) / max(dx * dx + dy * dy, 1.0);
    }
    if (sum < threshold * 0.72) {
        return half4(0.0);
    }
    half t = half(clamp(position.y / max(size.y, 1.0), 0.0, 1.0));
    half3 rgb = mix(color1.rgb, color2.rgb, t);
    // 外缘渐入（threshold*0.72 → threshold）；核心提亮压得很轻，避免中部发白
    half edge = half(smoothstep(threshold * 0.72, threshold, sum));
    half glow = half(clamp((sum - threshold) * 0.03, 0.0, 0.12));
    half a = (half(0.86) + glow) * edge * currentColor.a;
    return half4((rgb + glow * 0.6) * a, a);
}
