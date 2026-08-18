/* 通用 UI 辅助 —— 屏幕切换、toast、DOM 构建、分享动作。
   经典脚本，依赖 window.RN.bridge（bridge.js 须先加载）。 */

window.RN = window.RN || {};

(function () {
  "use strict";

  /** 轻量 DOM 构建：el("div", {class:"x"}, [child|string]) */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "text") node.textContent = value;
        else if (key === "style") node.setAttribute("style", value);
        else node.setAttribute(key, value);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(
        typeof child === "string" ? document.createTextNode(child) : child,
      );
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /** 单页内视图切换：给目标 .screen 加 is-active */
  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle("is-active", screens[i].id === id);
    }
    var target = document.getElementById(id);
    var scroll = target && target.querySelector(".scroll");
    if (scroll) scroll.scrollTop = 0;
  }

  var toastTimer = null;

  function toast(message) {
    var node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("is-on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove("is-on");
    }, 2200);
  }

  function setRail(percent) {
    var rail = document.querySelector(".rail > i");
    if (rail) rail.style.width = Math.max(0, Math.min(1, percent)) * 100 + "%";
  }

  /**
   * 绑定「保存图片 / 发布笔记」两个动作。
   * getDataUri 为返回 data:uri 的函数（延迟到点击时才绘制，避免无谓开销）。
   */
  function bindShare(options) {
    var saveBtn = options.saveButton;
    var postBtn = options.postButton;
    var getDataUri = options.getDataUri;

    function guard(button, work, busyLabel) {
      var label = button.textContent;
      button.disabled = true;
      button.textContent = busyLabel;
      Promise.resolve()
        .then(work)
        .then(function () {
          toast(options.doneMessage || "已完成");
        })
        .catch(function (error) {
          toast((error && error.message) || "操作失败");
        })
        .then(function () {
          button.disabled = false;
          button.textContent = label;
        });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        if (!window.RN.bridge.available()) {
          toast("请在小红书 App 内使用该功能");
          return;
        }
        guard(
          saveBtn,
          function () {
            return window.RN.bridge.saveImage(getDataUri());
          },
          "保存中…",
        );
      });
    }

    if (postBtn) {
      postBtn.addEventListener("click", function () {
        if (!window.RN.bridge.available()) {
          toast("请在小红书 App 内使用该功能");
          return;
        }
        guard(
          postBtn,
          function () {
            return window.RN.bridge.postNote({
              dataUri: getDataUri(),
              title: options.noteTitle,
              content: options.noteContent && options.noteContent(),
            });
          },
          "打开中…",
        );
      });
    }
  }

  window.RN.ui = {
    el: el,
    clear: clear,
    showScreen: showScreen,
    toast: toast,
    setRail: setRail,
    bindShare: bindShare,
  };
})();
