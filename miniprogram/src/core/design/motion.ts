/**
 * 动效强度偏好。
 *
 * iOS 读系统的 `accessibilityReduceMotion`，小程序**没有对应的系统信号** ——
 * `wx.getSystemSetting()` / `getAppBaseInfo()` 都不暴露这个无障碍设置。
 * 所以只能做成应用内开关（Me 页），默认跟随 iOS 的行为即"开动效"。
 *
 * 四个签名动画（光球 / 万花筒 / 转盘 / 波形）都必须读它：关掉后要静置到一个
 * 好看的定格，而不是简单地不渲染 —— iOS 的 reduceMotion 分支就是这么做的
 * （`OrbView` 在 reduceMotion 时 `t = 0`、`pulse = 0.5`，蜡团静置但仍成形）。
 */

const KEY = 'possibility_reduce_motion_v1'

let cached: boolean | undefined

export function reduceMotion(): boolean {
  if (cached === undefined) {
    try {
      cached = wx.getStorageSync(KEY) === true
    } catch {
      cached = false
    }
  }
  return cached
}

export function setReduceMotion(value: boolean): void {
  cached = value
  try {
    wx.setStorageSync(KEY, value)
  } catch {
    // 存储失败不影响本次会话
  }
}
