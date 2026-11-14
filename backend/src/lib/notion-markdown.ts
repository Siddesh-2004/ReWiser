// src/lib/notion-markdown.ts
// Turns Notion blocks into light markdown. Pure: no network, no database.
import type { NotionContentBlock } from '../services/notion.service';

const INDENT = '  ';

// Notion stores text as a list of pieces; join their plain text
function richText(items: { plain_text: string }[] | undefined): string {
  return (items ?? []).map((t) => t.plain_text).join('');
}

// The line a block produces on its own, or null if it produces none
function blockLine(block: NotionContentBlock): string | null {
  const data = block[block.type] ?? {};
  const text = richText(data.rich_text).trim();

  switch (block.type) {
    case 'heading_1':
      return text ? `# ${text}` : null;
    case 'heading_2':
      return text ? `## ${text}` : null;
    case 'heading_3':
      return text ? `### ${text}` : null;
    case 'bulleted_list_item':
      return text ? `- ${text}` : null;
    case 'numbered_list_item':
      return text ? `1. ${text}` : null; // markdown renumbers these by itself
    case 'to_do':
      return text ? `- [${data.checked ? 'x' : ' '}] ${text}` : null;
    case 'paragraph':
    case 'toggle':
    case 'quote':
    case 'callout':
      return text || null;
    case 'code': {
      const code = richText(data.rich_text);
      return code.trim() ? `\`\`\`${data.language ?? ''}\n${code}\n\`\`\`` : null;
    }
    case 'table_row':
      return (data.cells ?? []).map((cell: any[]) => richText(cell)).join(' | ');
    case 'equation':
      return data.expression ? `$$${data.expression}$$` : null;
    default:
      return null; // images, files, embeds, dividers, unsupported, child pages...
  }
}

function collect(blocks: NotionContentBlock[], depth: number, lines: string[]) {
  for (const block of blocks) {
    const line = blockLine(block);
    if (line !== null) lines.push(INDENT.repeat(depth) + line);

    // Containers with no text of their own (columns, tables, synced blocks) keep the same depth
    if (block.children?.length) {
      collect(block.children, line !== null ? depth + 1 : depth, lines);
    }
  }
}

export function blocksToMarkdown(blocks: NotionContentBlock[], maxChars = 30000): string {
  const lines: string[] = [];
  collect(blocks, 0, lines);

  // Add whole lines until the next one would pass the cap. Never cut mid-line.
  const kept: string[] = [];
  let size = 0;
  for (const line of lines) {
    const added = line.length + (kept.length ? 1 : 0); // +1 for the newline
    if (size + added > maxChars) break;
    kept.push(line);
    size += added;
  }
  return kept.join('\n');
}