'use client';

import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Minimal safe Markdown renderer for user-authored note/description text.
 *
 * Supports:
 *   - `#`/`##`/`###` headings
 *   - `-`/`*` bullet lists and `1.` numbered lists
 *   - `**bold**`, `*italic*`, `` `code` ``
 *   - `[link](url)` links (opened in a new tab, `noopener noreferrer`)
 *
 * The raw text is HTML-escaped before parsing and everything is rendered as
 * React elements — this component NEVER uses `dangerouslySetInnerHTML`.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const blocks = useMemo(() => renderMarkdown(content ?? ''), [content]);

  if (blocks.length === 0) return null;

  return <div className={cn('space-y-2', className)}>{blocks}</div>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Reverse of escapeHtml — used only for link hrefs so URLs keep working. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Only safe URL schemes are allowed to become clickable anchors. Anything else
 * (`javascript:`, `data:`, `vbscript:`, unknown `scheme:` …) renders as plain
 * text so user-authored notes can never inject an executable link.
 */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^mailto:/i.test(trimmed)) return true;
  if (/^tel:/i.test(trimmed)) return true;
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) return true;
  // Anything with a colon we don't recognize above is an unknown/unsafe scheme.
  return !trimmed.includes(':');
}

const INLINE_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // [text](url)
      const href = decodeEntities(match[2]).trim();
      if (isSafeUrl(href)) {
        nodes.push(
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {renderInline(match[1])}
          </a>,
        );
      } else {
        // Unsafe scheme — render the link text as plain text, never an anchor.
        nodes.push(<Fragment key={key++}>{renderInline(match[1])}</Fragment>);
      }
    } else if (match[3] !== undefined) {
      // **bold**
      nodes.push(<strong key={key++}>{renderInline(match[3])}</strong>);
    } else if (match[4] !== undefined) {
      // *italic*
      nodes.push(<em key={key++}>{renderInline(match[4])}</em>);
    } else if (match[5] !== undefined) {
      // `code`
      nodes.push(
        <code key={key++} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {match[5]}
        </code>,
      );
    }

    lastIndex = INLINE_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}

type ListKind = 'ul' | 'ol';

function renderMarkdown(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let listKind: ListKind | null = null;
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listKind) {
      const items = listItems.map((item, i) => (
        <li key={i} className="text-sm text-foreground/80">
          {renderInline(item)}
        </li>
      ));
      blocks.push(
        listKind === 'ul' ? (
          <ul key={key++} className="list-disc space-y-1 pl-5">
            {items}
          </ul>
        ) : (
          <ol key={key++} className="list-decimal space-y-1 pl-5">
            {items}
          </ol>
        ),
      );
    }
    listKind = null;
    listItems = [];
  };

  const lines = escapeHtml(content).split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const text = renderInline(heading[2]);
      if (level === 1) {
        blocks.push(
          <h1 key={key++} className="text-lg font-semibold text-foreground">
            {text}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={key++} className="text-base font-semibold text-foreground">
            {text}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 key={key++} className="text-sm font-semibold text-foreground">
            {text}
          </h3>,
        );
      }
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (listKind !== 'ul') {
        flushList();
        listKind = 'ul';
      }
      listItems.push(bullet[1]);
      continue;
    }

    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (listKind !== 'ol') {
        flushList();
        listKind = 'ol';
      }
      listItems.push(numbered[2]);
      continue;
    }

    if (line.trim() === '') {
      flushList();
      continue;
    }

    flushList();
    blocks.push(
      <p key={key++} className="text-sm text-foreground/80">
        {renderInline(line)}
      </p>,
    );
  }

  flushList();

  return blocks;
}
