import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config();

export interface WorkspaceConfig {
  name: string;
  token: string;
  description?: string;
}

export interface AppConfig {
  workspaces: WorkspaceConfig[];
}

/**
 * Loads workspace configurations from three sources (merged in order):
 *  1. NOTION_TOKEN / NOTION_WORKSPACE_NAME env vars (single workspace)
 *  2. NOTION_TOKEN_1…N / NOTION_WORKSPACE_NAME_1…N env vars (multiple)
 *  3. workspaces.json (or the path in NOTION_WORKSPACES_CONFIG)
 */
export function loadConfig(): AppConfig {
  const workspaces: WorkspaceConfig[] = [];
  const seen = new Set<string>();

  const add = (ws: WorkspaceConfig) => {
    if (!seen.has(ws.name)) {
      seen.add(ws.name);
      workspaces.push(ws);
    }
  };

  // 1. Single workspace from NOTION_TOKEN
  if (process.env.NOTION_TOKEN) {
    add({
      name: process.env.NOTION_WORKSPACE_NAME ?? 'default',
      token: process.env.NOTION_TOKEN,
      description: process.env.NOTION_WORKSPACE_DESCRIPTION,
    });
  }

  // 2. Numbered env vars: NOTION_TOKEN_1, NOTION_TOKEN_2, …
  let i = 1;
  while (process.env[`NOTION_TOKEN_${i}`]) {
    add({
      name: process.env[`NOTION_WORKSPACE_NAME_${i}`] ?? `workspace-${i}`,
      token: process.env[`NOTION_TOKEN_${i}`]!,
      description: process.env[`NOTION_WORKSPACE_DESCRIPTION_${i}`],
    });
    i++;
  }

  // 3. JSON config file
  const configPath =
    process.env.NOTION_WORKSPACES_CONFIG ??
    path.join(process.cwd(), 'workspaces.json');

  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
      workspaces?: WorkspaceConfig[];
    };
    if (Array.isArray(raw.workspaces)) {
      for (const ws of raw.workspaces) {
        add(ws);
      }
    }
  }

  return { workspaces };
}
