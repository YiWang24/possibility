/* JSBridge 封装 —— 仅使用 jsbridge-api.md 列出的 API 与字段。
   容器注入 window.xhs.miniTool；不传回调时各 API 返回 Promise。
   经典脚本，挂载到 window.RN 命名空间，不使用 import / export。 */

window.RN = window.RN || {};

(function () {
  "use strict";

  /** postNote 字段上限，取自 jsbridge-api.md */
  var TITLE_MAX = 20;
  var CONTENT_MAX = 1000;

  function miniTool() {
    return (window.xhs && window.xhs.miniTool) || null;
  }

  /** 容器外（本地浏览器 / 未注入）返回 false，调用方据此降级提示 */
  function available() {
    return !!miniTool();
  }

  /** 把 bridge 的 error 归一成可读文案；errMsg 形如 "<api>:fail xxx" */
  function reason(error, fallback) {
    if (!error) return fallback;
    var msg = typeof error === "string" ? error : error.errMsg || error.message;
    if (!msg) return fallback;
    var tail = String(msg).split(":fail").pop();
    tail = tail && tail.trim();
    return tail || fallback;
  }

  function requireDataUri(dataUri) {
    if (typeof dataUri !== "string" || dataUri.indexOf("data:") !== 0) {
      // writeTempFile 只接受完整 data:uri，裸 base64 会失败
      throw new Error("图片数据格式不正确");
    }
  }

  /** data:uri → 临时文件路径 */
  function writeTempFile(dataUri) {
    var mt = miniTool();
    requireDataUri(dataUri);
    return mt.writeTempFile({ data: dataUri }).then(function (res) {
      var filePath = res && res.filePath;
      if (!filePath) throw new Error("临时文件写入失败");
      return filePath;
    });
  }

  /** 保存到系统相册：data:uri → writeTempFile → saveImageToPhotosAlbum */
  function saveImage(dataUri) {
    var mt = miniTool();
    if (!mt) return Promise.reject(new Error("当前环境不支持保存图片"));
    return writeTempFile(dataUri)
      .then(function (filePath) {
        return mt.saveImageToPhotosAlbum({ filePath: filePath });
      })
      .catch(function (error) {
        throw new Error(reason(error, "保存失败，请重试"));
      });
  }

  /**
   * 发布图文笔记。
   * @param {{dataUri: string, title?: string, content?: string}} options
   */
  function postNote(options) {
    var mt = miniTool();
    if (!mt) return Promise.reject(new Error("当前环境不支持发布笔记"));
    var opts = options || {};
    requireDataUri(opts.dataUri);

    var payload = {
      pageType: "photo_publish",
      mediaInfo: { image_resources: [{ url: opts.dataUri }] },
    };
    if (opts.title) payload.title = String(opts.title).slice(0, TITLE_MAX);
    if (opts.content) payload.content = String(opts.content).slice(0, CONTENT_MAX);

    return mt.postNote(payload).catch(function (error) {
      throw new Error(reason(error, "发布失败，请重试"));
    });
  }

  window.RN.bridge = {
    available: available,
    saveImage: saveImage,
    postNote: postNote,
    TITLE_MAX: TITLE_MAX,
    CONTENT_MAX: CONTENT_MAX,
  };
})();
