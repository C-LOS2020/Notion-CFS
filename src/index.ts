#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { createWorkspaceClients } from './notionClient.js';
import { buildTools } from './tools.js';

async function main() {
  const config = loadConfig();

  if (config.workspaces.length === 0) {
    process.stderr.write(
      [
        'Error: No Notion workspaces configured.',
        'Options:',
        '  1. Set NOTION_TOKEN (+ optional NOTION_WORKSPACE_NAME) in .env',
        '  2. Set NOTION_TOKEN_1, NOTION_TOKEN_2, … for multiple workspaces',
        '  3. Copy workspaces.example.json → workspaces.json and fill in tokens',
        'Get an integration token at https://www.notion.so/my-integrations',
        '',
      ].join('\n')
    );
    process.exit(1);
  }

  const workspaceClients = createWorkspaceClients(config.workspaces);

  const server = new Server(
    { name: 'notion-cfs', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const tools = buildTools(workspaceClients);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.definition.name === request.params.name);
    if (!tool) {
      return {
        content: [
          { type: 'text', text: `Unknown tool: ${request.params.name}` },
        ],
        isError: true,
      };
    }
    return tool.handler(
      (request.params.arguments ?? {}) as Record<string, unknown>
    );
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const names = workspaceClients.map((w) => w.name).join(', ');
  process.stderr.write(
    `Notion-CFS MCP server running | ${workspaceClients.length} workspace(s): ${names}\n`
  );
}

main().catch((e: Error) => {
  process.stderr.write(`Fatal: ${e.message}\n`);
  process.exit(1);
});
