'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const REGULATION_REGEX = /(K\.A\.R\.\s*[\d]+-[\d]+-[\d]+)/g;
const COLLAPSED_MAX_HEIGHT_PX = 128;
const LONG_CHAR_THRESHOLD = 280;

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'regulation'; text: string }
  | { type: 'source'; text: string }
  | { type: 'bullets'; items: string[] };

function trimUrl(url: string): string {
  return url.replace(/[.,;:!?)]+$/g, '');
}

function isBulletLine(line: string): boolean {
  return /^[•◾\-\*]\s/.test(line.trim());
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[•◾\-\*]\s*/, '');
}

function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.endsWith(':') &&
    trimmed.length <= 80 &&
    !trimmed.startsWith('http') &&
    !/^source:/i.test(trimmed)
  );
}

function isRegulationLine(line: string): boolean {
  return /^K\.A\.R\.\s*[\d]+-[\d]+-[\d]+$/i.test(line.trim());
}

function isSourceLine(line: string): boolean {
  return /^source:/i.test(line.trim());
}

function parseDescriptionBlocks(text: string): ContentBlock[] {
  const lines = text.split('\n');
  const blocks: ContentBlock[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      blocks.push({ type: 'bullets', items: [...bulletBuffer] });
      bulletBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      continue;
    }

    if (isBulletLine(line)) {
      flushBullets();
      bulletBuffer.push(stripBulletPrefix(line));
      continue;
    }

    flushBullets();

    if (isRegulationLine(line)) {
      blocks.push({ type: 'regulation', text: trimmed });
      continue;
    }

    if (isSourceLine(line)) {
      blocks.push({ type: 'source', text: trimmed });
      continue;
    }

    if (isSectionHeading(line)) {
      blocks.push({ type: 'heading', text: trimmed });
      continue;
    }

    blocks.push({ type: 'paragraph', text: trimmed });
  }

  flushBullets();
  return blocks;
}

function isRegulationRef(text: string): boolean {
  return /^K\.A\.R\.\s*[\d]+-[\d]+-[\d]+$/i.test(text.trim());
}

function renderRichInlineText(text: string, keyPrefix: string): ReactNode[] {
  const tokens = text.split(URL_REGEX);
  const nodes: ReactNode[] = [];

  tokens.forEach((token, index) => {
    if (!token) return;

    if (/^https?:\/\//i.test(token)) {
      const href = trimUrl(token);
      nodes.push(
        <a
          key={`${keyPrefix}-url-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-medium text-[#1E3A8A] underline decoration-[#1E3A8A]/40 underline-offset-2 hover:decoration-[#1E3A8A]"
        >
          {href}
        </a>
      );
      return;
    }

    const regulationParts = token.split(REGULATION_REGEX);
    regulationParts.forEach((part, partIndex) => {
      if (!part) return;
      if (isRegulationRef(part)) {
        nodes.push(
          <strong
            key={`${keyPrefix}-reg-${index}-${partIndex}`}
            className="font-semibold text-blue-950"
          >
            {part}
          </strong>
        );
        return;
      }
      nodes.push(
        <span key={`${keyPrefix}-txt-${index}-${partIndex}`}>{part}</span>
      );
    });
  });

  return nodes;
}

function DescriptionContent({ text }: { text: string }) {
  const blocks = useMemo(() => parseDescriptionBlocks(text), [text]);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-700">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p
              key={index}
              className="text-sm font-semibold text-blue-950"
            >
              {block.text}
            </p>
          );
        }

        if (block.type === 'regulation') {
          return (
            <p
              key={index}
              className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm font-semibold text-blue-950"
            >
              {block.text}
            </p>
          );
        }

        if (block.type === 'source') {
          return (
            <p key={index} className="text-xs italic text-gray-500">
              {renderRichInlineText(block.text, `source-${index}`)}
            </p>
          );
        }

        if (block.type === 'bullets') {
          return (
            <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-[#1E3A8A]">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-0.5">
                  {renderRichInlineText(item, `bullet-${index}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index}>{renderRichInlineText(block.text, `para-${index}`)}</p>
        );
      })}
    </div>
  );
}

type DocumentDescriptionProps = {
  text: string;
};

export default function DocumentDescription({ text }: DocumentDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_CHAR_THRESHOLD;

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
      <div className="relative">
        <div
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{
            maxHeight:
              !isLong || expanded ? 'none' : `${COLLAPSED_MAX_HEIGHT_PX}px`,
          }}
        >
          <DescriptionContent text={text} />
        </div>

        {isLong && !expanded && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-50 to-transparent"
            aria-hidden
          />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp size={14} strokeWidth={2} aria-hidden />
            </>
          ) : (
            <>
              Show more
              <ChevronDown size={14} strokeWidth={2} aria-hidden />
            </>
          )}
        </button>
      )}
    </div>
  );
}