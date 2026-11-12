window.__ModuleLoader__.load({
  id: "dsh-session-delete",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");

    const ROW_SLOT = "sidebar.workspaces.session.row.action";
    const OVERLAY_SLOT = "shell.overlay";
    const ID = "session-delete";
    const ENDPOINT = "/session-delete/delete";

    // ---------------------------------------------------------------- 样式
    // 全部走宿主主题 token（--dsw-alias-*），没有 token 时退回深色缺省值，
    // 这样浅色/深色主题都能看，不会像原生 confirm 那样突兀。
    const T = {
      mask: "var(--dsw-alias-bg-mask-1, rgba(8,10,14,.55))",
      surface: "var(--dsw-alias-bg-layer-2, #1e222a)",
      surfaceHover: "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06))",
      border: "var(--dsw-alias-border-l2, rgba(255,255,255,.12))",
      text: "var(--dsw-alias-label-primary, #e9eaed)",
      textDim: "var(--dsw-alias-label-secondary, #9aa0aa)",
      danger: "var(--dsw-alias-label-error, #f0625d)",
      dangerBg: "var(--dsw-alias-interactive-bg-hover-danger, rgba(240,98,93,.14))",
      warnBg: "var(--dsw-alias-interactive-bg-hover-danger, rgba(240,98,93,.10))",
    };

    const style = {
      row: {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: "18px", height: "18px", padding: "0 3px",
        border: "1px solid transparent", borderRadius: "5px",
        background: "transparent", color: "inherit", opacity: 0.72,
        cursor: "pointer", font: "inherit", fontSize: "11px", lineHeight: 1,
      },
      mask: {
        position: "fixed", inset: 0, zIndex: 2147483000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: T.mask, padding: "24px",
      },
      card: {
        width: "min(440px, calc(100vw - 48px))",
        background: T.surface, color: T.text,
        border: "1px solid " + T.border, borderRadius: "14px",
        boxShadow: "0 24px 64px rgba(0,0,0,.5)",
        padding: "20px 22px 16px", font: "inherit",
        display: "flex", flexDirection: "column", gap: "12px",
      },
      head: { display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 600 },
      body: { fontSize: "13px", lineHeight: 1.65, color: T.textDim },
      name: { color: T.text, fontWeight: 500 },
      warn: {
        fontSize: "12.5px", lineHeight: 1.6, color: T.danger,
        background: T.warnBg, border: "1px solid " + T.danger + "33",
        borderRadius: "9px", padding: "8px 10px",
      },
      error: { fontSize: "12.5px", lineHeight: 1.6, color: T.danger },
      footer: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" },
      btn: {
        height: "30px", padding: "0 14px", borderRadius: "8px",
        border: "1px solid " + T.border, background: "transparent",
        color: T.text, fontSize: "13px", cursor: "pointer", font: "inherit",
      },
      btnDanger: {
        height: "30px", padding: "0 14px", borderRadius: "8px",
        border: "1px solid " + T.danger + "66", background: T.dangerBg,
        color: T.danger, fontSize: "13px", fontWeight: 500, cursor: "pointer", font: "inherit",
      },
      btnDisabled: { opacity: 0.5, cursor: "progress" },
    };

    // ---------------------------------------------------------------- 状态
    // shell.overlay 是 list 座位、渲染时不带 props，所以对话框自己维护一份模块级状态，
    // 行内按钮只负责 setDialog。零轮询，退出时退订。
    let dialog = null;
    const listeners = new Set();

    function setDialog(next) {
      dialog = next;
      for (const fn of listeners) { try { fn() } catch { /* 单个订阅者坏了不影响其它 */ } }
    }

    function useDialogState() {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const fn = () => bump((n) => (n + 1) % 1000000);
        listeners.add(fn);
        return () => { listeners.delete(fn); };
      }, []);
      return dialog;
    }

    // ---------------------------------------------------------------- 工具
    function post(sessionId, force) {
      return fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(force ? { sessionId, force: true } : { sessionId }),
      })
        .then((res) => res.json().then((data) => ({ status: res.status, data })).catch(() => ({ status: res.status, data: null })))
        .catch((error) => ({ status: 0, data: { ok: false, error: error && error.message ? error.message : String(error) } }));
    }

    /** 浏览器当前打开的会话 id（ui-workspace 存在 dsh.sessions.current 里）。 */
    function currentSessionId() {
      try {
        const raw = window.localStorage.getItem("dsh.sessions.current");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") return parsed;
        return parsed && parsed.sessionId ? String(parsed.sessionId) : null;
      } catch { return null; }
    }

    /** 清掉这条会话在浏览器侧留下的视图状态，免得重启后被还原。 */
    function purgeClientState(sessionId) {
      try {
        const store = window.localStorage;
        if (!store) return;
        const doomed = new Set(["dsh.conversation." + sessionId, "dsh.sidebar-right.v1." + sessionId]);
        const current = store.getItem("dsh.sessions.current");
        if (current && current.indexOf(sessionId) >= 0) doomed.add("dsh.sessions.current");
        for (let i = store.length - 1; i >= 0; i -= 1) {
          const key = store.key(i);
          if (key && key.indexOf(sessionId) >= 0) doomed.add(key);
        }
        for (const key of doomed) {
          if (key === "dsh.sessions.current" && current && current.indexOf(sessionId) < 0) continue;
          try { store.removeItem(key); } catch { /* 单项失败跳过 */ }
        }
      } catch { /* localStorage 不可用就跳过 */ }
    }

    function finish(sessionId, delay) {
      purgeClientState(sessionId);
      setTimeout(() => {
        try { window.location.reload(); } catch { window.location.href = "/"; }
      }, delay || 0);
    }

    // ---------------------------------------------------------------- 按钮
    function DeleteRowButton(props) {
      const sessionId = props && props.sessionId ? String(props.sessionId) : null;
      const title = (props && props.displayTitle) || "";
      return React.createElement(
        "button",
        {
          type: "button",
          "data-dsh-session-delete": "1",
          title: "删除会话（真删，宿主 registry 一起忘掉）",
          "aria-label": "删除会话",
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!sessionId) { window.alert("删除失败：宿主没有把 sessionId 传给按钮"); return; }
            setDialog({ sessionId, title, phase: "confirm", busy: false, error: null });
          },
          style: style.row,
        },
        "🗑",
      );
    }

    // ---------------------------------------------------------------- 对话框
    function Btn({ label, onClick, danger, disabled, autoFocus }) {
      const [hover, setHover] = React.useState(false);
      const base = danger ? style.btnDanger : style.btn;
      return React.createElement("button", {
        type: "button",
        ref: autoFocus ? (el) => { try { el && el.focus() } catch { /* 忽略 */ } } : undefined,
        onClick,
        disabled,
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        style: Object.assign({}, base, hover && !disabled ? { background: T.surfaceHover } : null, disabled ? style.btnDisabled : null),
      }, label);
    }

    function DeleteDialog() {
      const state = useDialogState();
      const cardRef = React.useRef(null);

      React.useEffect(() => {
        if (!state) return undefined;
        const onKey = (event) => {
          if (event.key === "Escape" && !state.busy) { event.preventDefault(); setDialog(null); }
        };
        window.addEventListener("keydown", onKey, true);
        return () => { try { window.removeEventListener("keydown", onKey, true) } catch { /* 已卸载 */ } };
      }, [state]);

      if (!state) return null;

      const isForce = state.phase === "force";
      const close = () => { if (!state.busy) setDialog(null); };
      const run = (force) => {
        setDialog(Object.assign({}, state, { busy: true, error: null }));
        post(state.sessionId, force).then(({ status, data }) => {
          if (status === 200 && data && data.ok) { setDialog(null); finish(state.sessionId, 0); return; }
          if (status === 202) { setDialog(null); finish(state.sessionId, 900); return; }
          if (status === 409 && data && data.code === "running") {
            setDialog(Object.assign({}, state, { phase: "force", busy: false, error: null }));
            return;
          }
          setDialog(Object.assign({}, state, {
            busy: false,
            error: (data && data.error) || ("HTTP " + status),
          }));
        });
      };

      const isCurrent = currentSessionId() === state.sessionId;

      return React.createElement(
        "div",
        {
          style: style.mask,
          onMouseDown: (event) => { if (event.target === event.currentTarget) close(); },
        },
        React.createElement(
          "div",
          {
            ref: cardRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "删除会话",
            style: style.card,
          },
          React.createElement("div", { style: style.head }, "🗑", "删除会话"),
          React.createElement(
            "div",
            { style: style.body },
            state.title
              ? React.createElement("span", null, "「", React.createElement("span", { style: style.name }, state.title), "」")
              : React.createElement("span", null, "这条会话"),
            "将被永久删除：对话正文、投影缓存、侧栏记录三处一起清掉，不可恢复。",
          ),
          isForce
            ? React.createElement(
                "div",
                { style: style.warn },
                isCurrent
                  ? "这条会话就是你正在看的这条，它还在运行。强制删除会立刻中断这一轮，确定继续？"
                  : "这条会话正在运行。强制删除会立刻中断它，确定继续？",
              )
            : null,
          state.error
            ? React.createElement("div", { style: style.error, role: "alert" }, "删除失败：" + state.error)
            : null,
          React.createElement(
            "div",
            { style: style.footer },
            React.createElement(Btn, { label: "取消", onClick: close, disabled: state.busy }),
            React.createElement(Btn, {
              label: state.busy ? "删除中…" : isForce ? "强制删除" : "删除",
              onClick: () => run(isForce),
              danger: true,
              disabled: state.busy,
            }),
          ),
        ),
      );
    }

    // ------------------------------------------------- 版本更新入口（搬进设置）
    // 桌面端原生在侧栏左下角放了「新版本」按钮（ui-settings-general 的
    // DesktopUpdateIndicator，类名形如 xxx_indicator）。这里把它藏起来，在
    // 「设置 → 通用」的「当前版本」行下面补一条同等能力的行；动作仍走原生桥
    // globalThis.dshDesktop.updates（status / subscribe / open），更新流程一点没改。
    const SETTINGS_ITEM_SLOT = "settings.general.item";
    const UPDATE_ROW_ID = "desktop-update";
    const UPDATE_ROW_ORDER = 150; // 当前版本行是 100，紧随其后
    const BUSY_PHASES = ["checking", "downloading", "verifying", "installing"];

    const UPDATE_ZH = {
      title: "版本更新",
      idleDesc: "有新版本时在这里检查并安装",
      check: "检查更新",
      checking: "正在检查更新…",
      availableDesc: "发现新版本 {version}",
      availableDescNoVersion: "发现新版本",
      update: "立即更新",
      downloadingDesc: "正在下载更新：{percent}%",
      downloadingShort: "{percent}%",
      verifying: "正在校验更新文件…",
      verifyingShort: "校验中",
      installing: "正在准备重启…",
      installingShort: "准备重启",
      ready: "安装并重启",
      retry: "重试更新",
      failedDesc: "更新服务不可用，点右侧按钮重试",
    };
    const UPDATE_EN = {
      title: "App update",
      idleDesc: "Check for and install new versions here",
      check: "Check for updates",
      checking: "Checking for updates…",
      availableDesc: "Version {version} is available",
      availableDescNoVersion: "A new version is available",
      update: "Update now",
      downloadingDesc: "Downloading update: {percent}%",
      downloadingShort: "{percent}%",
      verifying: "Verifying update files…",
      verifyingShort: "Verifying",
      installing: "Preparing to restart…",
      installingShort: "Restarting",
      ready: "Install and restart",
      retry: "Retry update",
      failedDesc: "Update service unavailable — retry on the right",
    };

    const styleItem = {
      row: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "16px", padding: "16px 0", fontSize: "14px", lineHeight: "22px",
        color: T.text,
      },
      text: { minWidth: 0 },
      desc: { fontSize: "12.5px", lineHeight: "18px", color: T.textDim, marginTop: "2px" },
      action: {
        height: "28px", padding: "0 12px", flex: "none", font: "inherit",
        fontSize: "12.5px", borderRadius: "var(--dsw-radius-sm, 6px)",
        border: "1px solid " + T.border, background: "transparent",
        color: T.text, cursor: "pointer", whiteSpace: "nowrap",
      },
      actionBusy: { opacity: 0.55, cursor: "default" },
    };

    function format(template, params) {
      if (!params) return template;
      return String(template).replace(/\{(\w+)\}/g, (whole, key) =>
        params[key] === undefined || params[key] === null ? whole : String(params[key]));
    }

    function makeT(dict) {
      return (key, params) => format(dict[key] === undefined ? key : dict[key], params);
    }

    function updateBridge() {
      try {
        const desktop = globalThis.dshDesktop;
        if (!desktop || desktop.protocolVersion !== 1) return null;
        return desktop.updates || null;
      } catch { return null; }
    }

    /** 订阅原生更新状态；没有桌面桥（浏览器访问）时 available=false。 */
    function useDesktopUpdate() {
      const [view, setView] = React.useState({ available: false, presentation: undefined, failed: false });
      React.useEffect(() => {
        const bridge = updateBridge();
        if (!bridge) return undefined;
        let live = true;
        let received = false;
        const patch = (next) => { if (live) setView((prev) => Object.assign({}, prev, next)); };
        patch({ available: true });
        let off;
        try {
          if (typeof bridge.subscribe === "function") {
            off = bridge.subscribe((presentation) => {
              received = true;
              patch({ presentation, failed: false });
            });
          }
        } catch { /* 订阅失败就用 status 的一次性结果 */ }
        try {
          const pending = typeof bridge.status === "function" ? bridge.status() : null;
          if (pending && typeof pending.then === "function") {
            pending.then(
              (presentation) => { if (!received) patch({ presentation }); },
              () => patch({ failed: true }),
            );
          }
        } catch { patch({ failed: true }); }
        return () => {
          live = false;
          try { if (typeof off === "function") off(); } catch { /* 已卸载 */ }
        };
      }, []);
      return view;
    }

    /** 「设置 → 通用」里的那一行。文案与状态跟原生指示器完全同源。 */
    function UpdateRow({ t }) {
      const view = useDesktopUpdate();
      const [opening, setOpening] = React.useState(false);
      const [hover, setHover] = React.useState(false);
      if (!view.available) return null;

      const state = view.presentation;
      const phase = view.failed ? "error" : state && state.phase ? state.phase : "idle";
      const percent = state && typeof state.percent === "number" ? state.percent : 0;
      const version = state && state.version ? String(state.version) : "";
      const busy = opening || BUSY_PHASES.indexOf(phase) >= 0;

      let desc = t("idleDesc");
      let action = t("check");
      if (phase === "error") { desc = t("failedDesc"); action = t("retry"); }
      else if (phase === "available") {
        desc = version ? t("availableDesc", { version }) : t("availableDescNoVersion");
        action = t("update");
      } else if (phase === "downloading") { desc = t("downloadingDesc", { percent }); action = t("downloadingShort", { percent }); }
      else if (phase === "checking") { desc = t("checking"); action = t("checking"); }
      else if (phase === "verifying") { desc = t("verifying"); action = t("verifyingShort"); }
      else if (phase === "installing") { desc = t("installing"); action = t("installingShort"); }
      else if (phase === "ready") { desc = t("ready"); action = t("ready"); }

      const run = () => {
        if (busy) return;
        const bridge = updateBridge();
        if (!bridge || typeof bridge.open !== "function") return;
        setOpening(true);
        try {
          const pending = bridge.open();
          if (pending && typeof pending.then === "function") pending.catch(() => {}).then(() => setOpening(false));
          else setOpening(false);
        } catch { setOpening(false); }
      };

      return React.createElement(
        "div",
        { style: styleItem.row },
        React.createElement(
          "div",
          { style: styleItem.text },
          React.createElement("div", null, t("title")),
          React.createElement("div", { style: styleItem.desc }, desc),
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: run,
            disabled: busy,
            onMouseEnter: () => setHover(true),
            onMouseLeave: () => setHover(false),
            style: Object.assign(
              {},
              styleItem.action,
              hover && !busy ? { background: T.surfaceHover } : null,
              busy ? styleItem.actionBusy : null,
            ),
          },
          action,
        ),
      );
    }

    /**
     * 藏掉侧栏左下角那个原生「新版本」按钮：
     * CSS 兜底（本构建的哈希类名）+ 运行时按 `_indicator` 后缀标记隐藏，
     * 后者对以后换构建的哈希也有效。
     */
    function installUpdateIndicatorHider() {
      const STYLE_ID = "dsh-session-delete-hide-update";
      try {
        if (!document.getElementById(STYLE_ID)) {
          const tag = document.createElement("style");
          tag.id = STYLE_ID;
          tag.textContent = 'button[class$="_indicator"],button[class*="_indicator "]{display:none!important}';
          (document.head || document.documentElement).appendChild(tag);
        }
      } catch { /* 没 head 就只靠运行时隐藏 */ }

      const hide = (root) => {
        try {
          const list = root && typeof root.querySelectorAll === "function" ? root.querySelectorAll("button") : [];
          for (const node of list) {
            const cls = typeof node.className === "string" ? node.className : "";
            if (cls.indexOf("_indicator") < 0) continue;
            if (node.getAttribute("data-dsh-update-hidden") === "1") continue;
            node.setAttribute("data-dsh-update-hidden", "1");
            node.style.display = "none";
          }
        } catch { /* 单次失败不影响后续 */ }
      };

      hide(document);
      try {
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node && node.nodeType === 1) hide(node);
            }
          }
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      } catch { /* 观察不可用时只剩 CSS 兜底 */ }
    }

    // ---------------------------------------------------------------- 注册
    function apply(ctx) {
      if (!ctx || !ctx.slots) return;

      ctx.slots.inject(ROW_SLOT, () =>
        ctx.slots.register(
          { name: ROW_SLOT, id: ID, order: 900, label: () => "删除会话" },
          (props) => React.createElement(DeleteRowButton, props || {}),
        ),
      );

      // 删除确认对话框占 overlay 座位；座位缺席时按钮仍可用（只是少了美化弹窗）
      try {
        ctx.slots.inject(OVERLAY_SLOT, () =>
          ctx.slots.register(
            { name: OVERLAY_SLOT, id: ID, order: 800 },
            () => React.createElement(DeleteDialog),
          ),
        );
      } catch { /* overlay 座位缺席时保持静默 */ }

      // 版本更新行：注册字典 + 塞进「设置 → 通用」
      let t = makeT(UPDATE_ZH);
      try {
        if (ctx.locale && typeof ctx.locale.register === "function") {
          const disposeDict = ctx.locale.register(ID, { zh: UPDATE_ZH, en: UPDATE_EN });
          if (typeof ctx.effect === "function") ctx.effect(() => disposeDict);
          if (typeof ctx.locale.bind === "function") t = ctx.locale.bind(ID);
        }
      } catch { /* 字典注册失败就用内置中文 */ }

      try {
        ctx.slots.inject(SETTINGS_ITEM_SLOT, () =>
          ctx.slots.register(
            { name: SETTINGS_ITEM_SLOT, id: UPDATE_ROW_ID, order: UPDATE_ROW_ORDER, locale: ID },
            () => React.createElement(UpdateRow, { t }),
          ),
        );
      } catch { /* 设置座位缺席时不出现该行 */ }

      installUpdateIndicatorHider();
    }

    const inject = ["slots"];

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
