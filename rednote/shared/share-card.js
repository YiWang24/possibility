/* 结果卡绘制 —— Canvas 2D 生成竖版分享图（3:4），供保存相册 / 发布笔记使用。
   canvas.toDataURL() 已是完整 data:uri，直接交给 bridge，不做任何截取。
   经典脚本，挂载 window.RN.shareCard。 */

window.RN = window.RN || {};

(function () {
  "use strict";

  var W = 1080;
  var H = 1440;
  var PAD = 88;

  var PAPER = "#0A0C12";
  var INK = "#F2F4F9";
  var INK_SOFT = "rgba(242,244,249,0.66)";
  var INK_FAINT = "rgba(242,244,249,0.38)";
  var LINE = "rgba(255,255,255,0.12)";

  var SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  var SERIF = '"Songti SC","Source Han Serif SC",Georgia,serif';

  function ctxFor() {
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    return { canvas: canvas, ctx: ctx };
  }

  /** 手动字距：部分 WebView 不支持 ctx.letterSpacing */
  function tracked(ctx, text, x, y, spacing) {
    var cursor = x;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + spacing;
    }
  }

  /** 按宽度折行，返回行数组 */
  function wrap(ctx, text, maxWidth) {
    var lines = [];
    var line = "";
    for (var i = 0; i < text.length; i++) {
      var next = line + text.charAt(i);
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = text.charAt(i);
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawHeader(ctx, kicker, title) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = '600 22px ' + SANS;
    tracked(ctx, kicker, PAD, 150, 4);

    ctx.fillStyle = INK;
    ctx.font = '600 62px ' + SERIF;
    var lines = wrap(ctx, title, W - PAD * 2);
    var y = 250;
    lines.slice(0, 2).forEach(function (line) {
      ctx.fillText(line, PAD, y);
      y += 78;
    });
    return y;
  }

  function drawSub(ctx, text, y) {
    if (!text) return y;
    ctx.fillStyle = INK_SOFT;
    ctx.font = '400 27px ' + SANS;
    var lines = wrap(ctx, text, W - PAD * 2);
    var cursor = y + 12;
    lines.slice(0, 3).forEach(function (line) {
      ctx.fillText(line, PAD, cursor);
      cursor += 42;
    });
    return cursor;
  }

  function rule(ctx, y) {
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    return y + 1;
  }

  /** 维度条形图：[{label, percent, color, name}] */
  function drawBars(ctx, rows, top) {
    var y = top;
    var barWidth = W - PAD * 2;
    rows.forEach(function (row) {
      ctx.fillStyle = INK;
      ctx.font = '600 30px ' + SANS;
      ctx.fillText(row.label, PAD, y);

      var pctText = Math.round(row.percent * 100) + "";
      ctx.fillStyle = INK_FAINT;
      ctx.font = '600 26px ' + SANS;
      var pctWidth = ctx.measureText(pctText).width;
      ctx.fillText(pctText, W - PAD - pctWidth, y);

      y += 20;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(PAD, y, barWidth, 8);
      ctx.fillStyle = row.color;
      ctx.fillRect(PAD, y, Math.max(4, barWidth * row.percent), 8);
      y += 56;
    });
    return y;
  }

  /** 关键词条目：[{glyph, name, copy}] */
  function drawEntries(ctx, entries, top, accent) {
    var y = top;
    entries.forEach(function (entry, index) {
      ctx.fillStyle = accent;
      ctx.font = '400 40px ' + SERIF;
      ctx.fillText(entry.glyph || "·", PAD, y + 6);

      ctx.fillStyle = INK;
      ctx.font = '600 36px ' + SANS;
      ctx.fillText(entry.name, PAD + 62, y);

      if (entry.copy) {
        ctx.fillStyle = INK_SOFT;
        ctx.font = '400 24px ' + SANS;
        var lines = wrap(ctx, entry.copy, W - PAD * 2 - 62);
        var cursor = y + 38;
        lines.slice(0, 2).forEach(function (line) {
          ctx.fillText(line, PAD + 62, cursor);
          cursor += 34;
        });
        y = cursor + 26;
      } else {
        y += 66;
      }
      if (index < entries.length - 1) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(PAD + 62, y - 16, W - PAD * 2 - 62, 1);
      }
    });
    return y;
  }

  function drawFooter(ctx, note) {
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD, H - 168, W - PAD * 2, 1);
    ctx.fillStyle = INK_FAINT;
    ctx.font = '600 22px ' + SANS;
    tracked(ctx, "万花筒 · 认识自己", PAD, H - 112, 3);
    if (note) {
      ctx.fillStyle = "rgba(242,244,249,0.28)";
      ctx.font = '400 21px ' + SANS;
      ctx.fillText(note, PAD, H - 74);
    }
  }

  /**
   * 渲染一张结果卡。
   * @param {{kicker:string,title:string,sub?:string,accent?:string,
   *          bars?:Array,entries?:Array,footnote?:string}} spec
   * @returns {string} 完整 data:uri
   */
  function render(spec) {
    var made = ctxFor();
    var ctx = made.ctx;

    // 顶部沿主色的一道细光，避免整版死平
    ctx.fillStyle = spec.accent || "#5E96FF";
    ctx.fillRect(0, 0, W, 6);

    var y = drawHeader(ctx, spec.kicker, spec.title);
    y = drawSub(ctx, spec.sub, y);
    y = rule(ctx, y + 30) + 62;

    if (spec.bars && spec.bars.length) y = drawBars(ctx, spec.bars, y);
    if (spec.entries && spec.entries.length) {
      y = drawEntries(ctx, spec.entries, y, spec.accent || "#5E96FF");
    }

    drawFooter(ctx, spec.footnote);
    return made.canvas.toDataURL("image/png");
  }

  window.RN.shareCard = { render: render };
})();
