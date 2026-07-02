// 状态栏悬浮窗脚本（纯 JS 版本，可直接复制到酒馆助手脚本库使用）
// 依赖：记事板.html 必须与该脚本放在同一可访问路径下，脚本会通过 fetch 加载它
// 例如把 小夜_悬浮窗口.js 和 记事板.html 一起上传到同一个 CDN/静态目录

(function () {
  // 改成 HTML 文件所在目录的完整 URL，末尾必须带斜杠。
  // 注意：不能用相对路径，因为脚本加载到酒馆页面后，相对路径会相对于酒馆页面，而不是 JS 文件本身。
  const NOTEBOOK_BASE_URL = 'https://cdn.jsdelivr.net//gh/abao-aball/my-tools-st/';

  // 根据 User-Agent 判断是否为手机/平板
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const NOTEBOOK_HTML_URL = NOTEBOOK_BASE_URL + (isMobile ? '手机记事板.html' : '记事板.html');

  let $container = null;
  let $iframe = null;
  let styleCleanup = null;
  // 每次打开窗口时生成一个 token，关闭后旧 token 失效，防止旧回调写入已被移除的 iframe
  let openToken = 0;

  function buildNotebookDocument(htmlText) {
    // 解析原 HTML 文本，提取 body 内容和 head 中的 style/link
    const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const headStyleMatch = htmlText.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    const googleFontLinks = htmlText.match(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi) || [];
    const lxgFontLink = htmlText.match(/<link[^>]*lxgw-wenkai-webfont[^>]*>/gi) || [];

    const bodyContent = bodyMatch ? bodyMatch[1].trim() : '';
    const styles = (headStyleMatch || []).join('\n');
    const fontLinks = googleFontLinks.concat(lxgFontLink).join('\n');

    return (
      '<!DOCTYPE html>\n' +
      '<html lang="zh-CN">\n' +
      '  <head>\n' +
      '    <meta charset="UTF-8" />\n' +
      '    ' +
      fontLinks +
      '\n' +
      '    ' +
      styles +
      '\n' +
      '  </head>\n' +
      '  <body>\n' +
      '    ' +
      bodyContent +
      '\n' +
      '  </body>\n' +
      '</html>'
    );
  }

  function mountApisToWindow(targetWindow) {
    // 把脚本运行环境的全局接口挂载到 iframe window，让原 HTML 里的脚本在 iframe 内可用
    targetWindow.$ = window.$;
    targetWindow.jQuery = window.jQuery;
    targetWindow.toastr = window.toastr;
    targetWindow._ = window._;
    targetWindow.getVariables = window.getVariables;
    targetWindow.replaceVariables = window.replaceVariables;
    targetWindow.Mvu = window.Mvu;
    targetWindow.eventOn = window.eventOn;
    targetWindow.tavern_events = window.tavern_events;
    targetWindow.waitGlobalInitialized = window.waitGlobalInitialized;
    targetWindow.getChatMessages = window.getChatMessages;
    targetWindow.getCurrentMessageId = function () {
      const lastMessage = window.getChatMessages(-1)[0];
      return lastMessage ? lastMessage.message_id : -1;
    };
  }

  function openNotebook(htmlText) {
    if ($container) return; // 已经打开

    const myToken = ++openToken;

    const containerCss = isMobile
      ? {
          position: 'fixed',
          top: '5vh',
          right: '2.5vw',
          width: '95vw',
          height: '90vh',
          'z-index': '9999',
        }
      : {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(1600px, 70vw)',
          height: 'min(1000px, 70vh)',
          'z-index': '9999',
        };

    $container = $('<div>').css(containerCss).appendTo('body');

    $iframe = $('<iframe>')
      .attr({
        frameborder: 0,
        srcdoc: '<!DOCTYPE html><html><body></body></html>',
      })
      .css({
        width: '100%',
        height: '100%',
        'border-radius': '16px',
        'box-shadow': '0 8px 32px rgba(0,0,0,0.35)',
        background: '#e8d5a5',
      })
      .appendTo($container);

    // 在 iframe 外层右上角加一个关闭按钮
    $('<button>')
      .text('✕')
      .attr('title', '关闭状态栏')
      .css({
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '40px',
        height: '40px',
        'border-radius': '50%',
        border: '2px solid #6b4c2b',
        background: '#d4b896',
        color: '#3a2818',
        'font-size': '20px',
        'font-weight': 'bold',
        'line-height': '1',
        cursor: 'pointer',
        'z-index': '10001',
        'box-shadow': '0 2px 6px rgba(0,0,0,0.25)',
      })
      .appendTo($container)
      .on('click', function () {
        closeNotebook();
      });

    $iframe.on('load', function () {
      const iframeEl = $iframe ? $iframe[0] : null;
      // 如果窗口已经被关闭或替换，token 不匹配，直接放弃旧加载
      if (!iframeEl || myToken !== openToken) {
        console.log('检测到旧的 iframe 加载回调，已忽略');
        return;
      }

      const doc = iframeEl.contentDocument;
      if (!doc) return;

      // 先挂载全局接口，确保 HTML 内部脚本执行时 $ 等 API 已可用
      mountApisToWindow(iframeEl.contentWindow);

      // 写入 HTML 内容
      doc.open();
      doc.write(buildNotebookDocument(htmlText));
      doc.close();
    });
  }

  function closeNotebook() {
    // 失效当前 token，防止旧加载回调继续写入
    openToken++;
    if ($container) {
      $container.remove();
      $container = null;
      $iframe = null;
    }
    if (styleCleanup) {
      styleCleanup();
      styleCleanup = null;
    }
  }

  function toggleNotebook(htmlText) {
    if ($container) {
      closeNotebook();
    } else {
      openNotebook(htmlText);
    }
  }

  function init(htmlText) {
    // 将打开/关闭函数挂载到父页面 window，方便外部 HTML 或正则调用
    window.parent.openTavernNotebook = function () {
      openNotebook(htmlText);
    };
    window.parent.closeTavernNotebook = closeNotebook;
    window.parent.toggleTavernNotebook = function () {
      toggleNotebook(htmlText);
    };

    // 卸载时清理
    $(window).on('pagehide', function () {
      closeNotebook();
    });
  }

  // 加载 HTML 内容后启动
  if (!NOTEBOOK_HTML_URL) {
    console.error('请在 小夜_悬浮窗口.js 顶部填写 NOTEBOOK_HTML_URL 为你的 HTML 文件完整 URL');
    toastr.error('状态栏脚本未配置 HTML 地址，请查看脚本顶部注释');
    return;
  }

  fetch(NOTEBOOK_HTML_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('加载记事板 HTML 失败: ' + res.status);
      return res.text();
    })
    .then(function (htmlText) {
      init(htmlText);
    })
    .catch(function (err) {
      console.error('状态栏脚本初始化失败:', err);
      toastr.error('状态栏脚本初始化失败: ' + err.message);
    });
})();
