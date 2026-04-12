import { Client } from '@notionhq/client';
import type { WorkspaceConfig } from './config.js';

export interface NotionWorkspace {
  name: string;
  description?: string;
  client: Client;
}

export function createWorkspaceClients(
  configs: WorkspaceConfig[]
): NotionWorkspace[] {
  return configs.map((ws) => ({
    name: ws.name,
    description: ws.description,
    client: new Client({ auth: ws.token }),
  }));
}

/** Returns the subset of workspaces matching `name`, or all if name is "all" / undefined. */
export function resolveWorkspaces(
  all: NotionWorkspace[],
  name: string | undefined
): NotionWorkspace[] {
  if (!name || name === 'all') return all;
  const ws = all.find((w) => w.name === name);
  if (!ws) {
    throw new Error(
      `Workspace "${name}" not found. Available: ${all.map((w) => w.name).join(', ')}`
    );
  }
  return [ws];
}

/** Converts a Notion rich-text array to a plain string. */
export function richTextToPlain(
  rt: Array<{ plain_text: string }>
): string {
  return rt.map((t) => t.plain_text).join('');
}

/** Extracts the display title from a Notion page or database object. */
export function getTitle(obj: Record<string, unknown>): string {
  // Database objects have a top-level `title` array
  if (
    obj.object === 'database' &&
    Array.isArray(obj.title)
  ) {
    return richTextToPlain(obj.title as Array<{ plain_text: string }>);
  }
  // Page objects keep the title in a `title`-type property
  if (obj.properties && typeof obj.properties === 'object') {
    const titleProp = Object.values(
      obj.properties as Record<string, Record<string, unknown>>
    ).find((p) => p.type === 'title');
    if (titleProp?.title && Array.isArray(titleProp.title)) {
      return richTextToPlain(
        titleProp.title as Array<{ plain_text: string }>
      );
    }
  }
  return '(Untitled)';
}
