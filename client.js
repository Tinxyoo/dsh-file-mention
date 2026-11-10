window.__ModuleLoader__.load({
  id: 'dsh-file-mention',
  factory(require) {
    const React = require('react');
    const { useEffect, useLayoutEffect, useRef, useState } = React;
    const h = React.createElement;

    const NS = 'fileMention';
    const ICON_KEY = 'file-mention.add';
    const MENTION_TARGET = 'file';
    const PREVIEW_FRAME_SELECTOR = '[data-textpreview-state]';
    const PREVIEW_BODY_SELECTOR = '[data-textpreview-content]';

    /** Menu, quote-button, and failure copy. */
    const zh = {
      'action.add': '添加到输入框',
      'action.failed': '无法添加到输入框：输入框当前不可编辑，或该文件不在工作区内',
      'quote.add': '引用到输入框',
      'quote.failed': '无法引用：输入框当前不可编辑',
    };
    const en = {
      'action.add': 'Add to input',
      'action.failed': 'Could not add the file reference: the composer is not editable right now, or the file is outside the workspace',
      'quote.add': 'Quote to input',
      'quote.failed': 'Could not quote: the composer is not editable right now',
    };

    /** The floating action matches the composer quote pill. */
    const QUOTE_CSS = `
.fmn-quote {
  position: fixed;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  corner-shape: round;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 999px;
  background: var(--dsw-alias-button-floating-fill);
  box-shadow: var(--dsw-elevation-panel);
  color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xs-13);
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
}
.fmn-quote:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
@media (hover: hover) {
  .fmn-quote:hover { background: var(--dsw-alias-button-floating-hover); }
}
.fmn-quote-glyph { flex: none; width: 14px; height: 14px; }
`;

    /** A small composer-plus-arrow glyph, drawn with the menu ink token. */
    function AddToInputIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 16,
        height: 16,
        'aria-hidden': true,
        focusable: false,
      },
        h('path', {
          d: 'M2 5.9A1.9 1.9 0 0 1 3.9 4h8.2A1.9 1.9 0 0 1 14 5.9v4.2a1.9 1.9 0 0 1-1.9 1.9H3.9A1.9 1.9 0 0 1 2 10.1Z',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.3,
        }),
        h('path', {
          d: 'M4.6 8h5.9M8.6 6l2 2-2 2',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      );
    }

    /** Two quotation marks for the floating quote action. */
    function QuoteGlyph() {
      return h('svg', {
        className: 'fmn-quote-glyph',
        viewBox: '0 0 16 16',
        'aria-hidden': true,
        focusable: false,
      },
        h('path', {
          d: 'M6.3 4.2C4.6 4.9 3.7 6.3 3.7 8c0 1.1.6 1.8 1.5 1.8.8 0 1.4-.6 1.4-1.4 0-.8-.5-1.3-1.2-1.3h-.2c.2-.8.7-1.3 1.5-1.7l-.4-1.2ZM11.7 4.2C10 4.9 9.1 6.3 9.1 8c0 1.1.6 1.8 1.5 1.8.8 0 1.4-.6 1.4-1.4 0-.8-.5-1.3-1.2-1.3h-.2c.2-.8.7-1.3 1.5-1.7l-.4-1.2Z',
          fill: 'currentColor',
        }),
      );
    }

    /** POSIX-style path with forward slashes and no trailing separator. */
    function slashed(path) {
      return path.replace(/\\/gu, '/').replace(/\/+$/u, '');
    }

    /**
     * Workspace-relative spelling of an absolute tree path.
     * @param cwd - the Session's working directory.
     * @param path - the absolute path carried by the tree's `file` target.
     * @returns the relative path, or `undefined` when it escapes the workspace.
     */
    function relativeTo(cwd, path) {
      const root = slashed(cwd);
      const target = slashed(path);
      if (root === '') return target;
      if (target === root) return undefined;
      if (target.startsWith(`${root}/`)) return target.slice(root.length + 1);
      return undefined;
    }

    /**
     * The `@path` grammar the composer reference source uses.
     * @param path - workspace-relative path.
     * @returns the mention text, or `undefined` for a path the grammar cannot carry.
     */
    function formatMention(path) {
      if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return undefined;
      return /\s/u.test(path) ? `@"${path}"` : `@${path}`;
    }

    /**
     * The mention text for one previewed file, resolved against the live root.
     * @param ctx - Client context.
     * @param sessionId - target Session.
     * @param absolutePath - the preview's Host path.
     * @returns the mention text, or `undefined` without a workspace-relative path.
     */
    function mentionFor(ctx, sessionId, absolutePath) {
      if (typeof sessionId !== 'string' || typeof absolutePath !== 'string') return undefined;
      const sessions = ctx.get('sessions');
      const cwd = sessions?.list?.getSnapshot()?.byId?.[sessionId]?.cwd;
      if (typeof cwd !== 'string' || cwd === '') return undefined;
      const relative = relativeTo(cwd, absolutePath);
      return relative === undefined ? undefined : formatMention(relative);
    }

    /**
     * The live composer shell for one Session, when that Session is retained.
     * @param ctx - Client context.
     * @param sessionId - target Session.
     * @returns the shell, or `undefined` without a retained binding or conversation service.
     */
    function composerFor(ctx, sessionId) {
      const sessions = ctx.get('sessions');
      if (sessions === undefined || sessions.binding(sessionId) === undefined) return undefined;
      const conversation = ctx.get('conversation');
      if (conversation === undefined) return undefined;
      try {
        return conversation.input.shell(sessionId);
      } catch (_error) {
        return undefined;
      }
    }

    /** The caret-relative text one insertion needs for a clean token boundary. */
    function insertionPadding(shell, span) {
      const projection = shell.projection;
      const text = typeof projection?.detectText === 'string' ? projection.detectText : '';
      const before = span.start > 0 ? text.slice(span.start - 1, span.start) : '';
      const after = text.slice(span.end, span.end + 1);
      return {
        lead: before !== '' && !/\s/u.test(before) ? ' ' : '',
        tail: after === '' || !/\s/u.test(after) ? ' ' : '',
      };
    }

    /**
     * Insert one reference token at the composer's captured caret.
     * @param shell - resident composer shell.
     * @param mention - `@path` or `@"path with spaces"`.
     * @returns whether the edit applied.
     */
    function insertMentionText(shell, mention) {
      const span = shell.actions.captureInsertion();
      const { lead, tail } = insertionPadding(shell, span);
      return shell.actions.insertText(`${lead}${mention}${tail}`, span) === true;
    }

    /**
     * The composer chip payload for one file mention, matching the `@` picker.
     * @param mention - `@path` or `@"path with spaces"`.
     * @returns the reference insertion the chip renders and serializes.
     */
    function chipReference(mention) {
      const raw = mention.startsWith('@"') ? mention.slice(2, -1) : mention.slice(1);
      const name = raw.split('/').filter(Boolean).at(-1) ?? raw;
      return {
        source: 'reference',
        ref: mention,
        label: name,
        appearance: 'file',
        clipboardText: mention,
      };
    }

    /**
     * Insert one file reference as the composer's atomic chip, so one Backspace
     * removes the whole reference instead of a character at a time.
     * @param ctx - Client context.
     * @param sessionId - target Session.
     * @param mention - `@path` or `@"path with spaces"`.
     * @returns `inserted`, `refused`, or `unavailable` without a session scope.
     */
    function insertFileChip(ctx, sessionId, mention) {
      const sessions = ctx.get('sessions');
      const scope = sessions?.scope?.(sessionId);
      if (scope === undefined) return 'unavailable';
      const shell = composerFor(ctx, sessionId);
      if (shell === undefined) return 'unavailable';
      const outcome = scope.bail(scope, 'slash/input-insert-reference', {
        reference: chipReference(mention),
        span: shell.actions.captureInsertion(),
      });
      if (outcome === true) return 'inserted';
      return outcome === undefined ? 'unavailable' : 'refused';
    }

    function elementOf(node) {
      if (node === null || node === undefined) return null;
      return node.nodeType === 1 ? node : node.parentElement ?? null;
    }

    /**
     * The current browser selection when it lies whole inside one text preview.
     * @param frame - the preview frame element owning this watcher.
     * @returns selected text and its first visible rectangle, or `null`.
     */
    function previewSelectionFor(frame) {
      if (frame === null || typeof document === 'undefined') return null;
      const body = frame.querySelector(PREVIEW_BODY_SELECTOR);
      if (body === null) return null;
      const selection = document.getSelection();
      if (selection === null || selection.rangeCount !== 1 || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return null;
      const start = elementOf(range.startContainer);
      if (start !== null && start.closest('[hidden], [inert], [data-files-navigator]') !== null) return null;
      const text = selection.toString().replace(/\r\n?/gu, '\n').trim();
      if (text === '') return null;
      const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
      const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
      const rect = rects.find((candidate) => candidate.bottom > 0 && candidate.top < viewportHeight)
        ?? rects[0]
        ?? range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return {
        text,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      };
    }

    /** The one pending file-content quote, published by the open preview. */
    const quoteState = {
      value: null,
      listeners: new Set(),
      set(value) {
        if (quoteState.value === value) return;
        quoteState.value = value;
        for (const listener of [...quoteState.listeners]) listener();
      },
      subscribe(listener) {
        quoteState.listeners.add(listener);
        return () => quoteState.listeners.delete(listener);
      },
    };

    function useQuoteState() {
      const [value, setValue] = useState(quoteState.value);
      useEffect(() => {
        setValue(quoteState.value);
        return quoteState.subscribe(() => setValue(quoteState.value));
      }, []);
      return value;
    }

    /**
     * Watch one text preview for a selection and publish the floating action.
     * Rendered in the preview toolbar, so it unmounts with the preview tab.
     */
    function PreviewQuoteWatcher({ sessionId, inputActions }) {
      const markerRef = useRef(null);

      useEffect(() => {
        if (typeof sessionId !== 'string' || inputActions === undefined) return undefined;
        const token = { sessionId };
        let frame = 0;
        const frameOf = () => markerRef.current?.closest(PREVIEW_FRAME_SELECTOR) ?? null;
        const publish = () => {
          frame = 0;
          const frameElement = frameOf();
          const found = previewSelectionFor(frameElement);
          if (found === null) {
            if (quoteState.value?.token === token) quoteState.set(null);
            return;
          }
          quoteState.set({
            token,
            frame: frameElement,
            sessionId,
            text: found.text,
            rect: found.rect,
            insert: (text) => insertQuote(inputActions, sessionId, text),
          });
        };
        const schedule = () => {
          if (frame !== 0) return;
          frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(publish) : 0;
          if (frame === 0) publish();
        };
        let selecting = false;
        const onKeyDown = (event) => {
          if (event.key === 'Escape' && quoteState.value?.token === token) quoteState.set(null);
        };
        const onSelectionChange = () => {
          if (!selecting) schedule();
        };
        const onPointerDown = (event) => {
          if (event.target instanceof Element && event.target.closest('[data-quote-selection-action]') !== null) return;
          selecting = event.button === 0;
          if (quoteState.value?.token === token) quoteState.set(null);
        };
        const onPointerUp = (event) => {
          if (!selecting) return;
          selecting = false;
          schedule();
        };
        document.addEventListener('selectionchange', onSelectionChange);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('keyup', schedule, true);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('scroll', schedule, true);
        window.addEventListener('resize', schedule);
        schedule();
        return () => {
          document.removeEventListener('selectionchange', onSelectionChange);
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('pointerup', onPointerUp, true);
          document.removeEventListener('keyup', schedule, true);
          document.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('scroll', schedule, true);
          window.removeEventListener('resize', schedule);
          if (frame !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
          if (quoteState.value?.token === token) quoteState.set(null);
        };
      }, [sessionId, inputActions]);

      return h('span', { ref: markerRef, hidden: true, 'aria-hidden': true });
    }

    /**
     * Insert the selected file content as the composer's one atomic quote card.
     * @param actions - the composer's input actions.
     * @param sessionId - target Session.
     * @param text - selected file content.
     * @returns whether the draft changed.
     */
    function insertQuote(actions, sessionId, text) {
      const shell = composerFor(pluginCtx, sessionId);
      if (shell === undefined) return false;
      if (shell.state.getSnapshot().phase !== 'plain') return false;
      return actions.insertQuote(text) === true;
    }

    /** Floating quote action for one text selection in a file preview. */
    function QuoteSelectionButton({ t, notify }) {
      const value = useQuoteState();
      const buttonRef = useRef(null);
      const [placement, setPlacement] = useState(null);

      useLayoutEffect(() => {
        if (value === null) {
          if (placement !== null) setPlacement(null);
          return;
        }
        const element = buttonRef.current;
        if (element === null) return;
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        const gap = 8;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const left = Math.min(
          Math.max(8, value.rect.left + value.rect.width / 2 - width / 2),
          Math.max(8, viewportWidth - 8 - width),
        );
        let top = value.rect.top - gap - height;
        if (top < 8) top = Math.min(value.rect.bottom + gap, Math.max(8, viewportHeight - 8 - height));
        if (placement !== null && placement.value === value && placement.left === left && placement.top === top) return;
        setPlacement({ value, left, top });
      }, [value, placement]);

      if (value === null) return null;
      const measured = placement !== null && placement.value === value ? placement : null;
      const label = t('quote.add');
      return h(React.Fragment, null,
        h('style', { key: 'css' }, QUOTE_CSS),
        h('button', {
          key: 'button',
          ref: buttonRef,
          type: 'button',
          className: 'fmn-quote',
          'data-quote-selection-action': '',
          'aria-label': label,
          title: label,
          style: measured === null
            ? { left: 0, top: 0, visibility: 'hidden' }
            : { left: `${measured.left}px`, top: `${measured.top}px` },
          onPointerDown: (event) => {
            event.preventDefault();
          },
          onClick: () => {
            const current = quoteState.value;
            if (current === null) return;
            const frame = current.frame ?? null;
            const now = frame !== null && frame.isConnected ? previewSelectionFor(frame) : null;
            if (now === null) {
              quoteState.set(null);
              return;
            }
            const inserted = current.insert(now.text);
            document.getSelection()?.removeAllRanges();
            quoteState.set(null);
            if (!inserted) notify(t('quote.failed'), false);
          },
        }, h(QuoteGlyph), h('span', null, label)));
    }

    /** Context of the running plugin, captured for the action closures. */
    let pluginCtx = null;

    return {
      inject: ['slots', 'locale', 'contextMenus', 'sessions'],
      apply(ctx) {
        pluginCtx = ctx;
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'file-mention: dictionaries');
        const t = ctx.locale.bind(NS);

        ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
          name: 'contextMenu.icon',
          key: ICON_KEY,
        }, AddToInputIcon));

        ctx.effect(() => ctx.contextMenus.register({
          id: 'file-mention.file',
          target: MENTION_TARGET,
          order: 80,
          resolve: (target) => {
            const { sessionId, path } = target;
            if (typeof sessionId !== 'string' || typeof path !== 'string') return [];
            if (composerFor(ctx, sessionId) === undefined) return [];
            const mention = mentionFor(ctx, sessionId, path);
            if (mention === undefined) return [];
            return [{
              id: 'addToInput',
              icon: { key: ICON_KEY },
              label: t('action.add'),
              failureLabel: t('action.failed'),
              run: () => {
                const shell = composerFor(ctx, sessionId);
                if (shell === undefined) throw new Error('file-mention: no composer for this Session');
                const outcome = insertFileChip(ctx, sessionId, mention);
                if (outcome === 'refused') {
                  throw new Error('file-mention: the composer refused the insertion');
                }
                if (outcome === 'unavailable' && !insertMentionText(shell, mention)) {
                  throw new Error('file-mention: the composer refused the insertion');
                }
                shell.focus();
              },
            }];
          },
        }), 'file-mention: workspace file menu');

        ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({
          name: 'sidebar.right.tab.document.actions',
          id: 'file-mention.quote-selection',
          order: 400,
        }, PreviewQuoteWatcher));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'file-mention.quote-action',
          order: -1,
        }, function FileMentionQuoteOverlay() {
          return h(QuoteSelectionButton, {
            t,
            notify: (text, success) => ctx.contextMenus.notify(text, success),
          });
        }));
      },
    };
  },
});
