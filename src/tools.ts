import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { NotionWorkspace } from './notionClient.js';
import { resolveWorkspaces, richTextToPlain, getTitle } from './notionClient.js';

// ─── Internal types ────────────────────────────────────────────────────────

type TextContent = { type: 'text'; text: string };
type ToolResult = { content: TextContent[]; isError?: boolean };
type Args = Record<string, unknown>;

export interface ToolDef {
  definition: Tool;
  handler: (args: Args) => Promise<ToolResult>;
}

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function fail(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown, def: number): number {
  return typeof v === 'number' ? v : def;
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

function parseProperty(val: Record<string, unknown>): string {
  switch (val.type) {
    case 'title':
      return richTextToPlain(val.title as Array<{ plain_text: string }>);
    case 'rich_text':
      return richTextToPlain(val.rich_text as Array<{ plain_text: string }>);
    case 'select':
      return str((val.select as Record<string, unknown>)?.name);
    case 'multi_select':
      return (val.multi_select as Array<{ name: string }>).map((o) => o.name).join(', ');
    case 'checkbox':
      return String(val.checkbox);
    case 'date':
      return str((val.date as Record<string, unknown>)?.start);
    case 'number':
      return String(val.number ?? '');
    case 'status':
      return str((val.status as Record<string, unknown>)?.name);
    case 'people':
      return (val.people as Array<Record<string, unknown>>).map((p) => str(p.name)).join(', ');
    case 'email':
      return str(val.email);
    case 'phone_number':
      return str(val.phone_number);
    case 'url':
      return str(val.url);
    default:
      return '';
  }
}

// ─── Tool builder ──────────────────────────────────────────────────────────

export function buildTools(workspaces: NotionWorkspace[]): ToolDef[] {
  const wsNames = workspaces.map((w) => w.name).join(' | ');

  return [
    // ── notion_list_workspaces ─────────────────────────────────────────
    {
      definition: {
        name: 'notion_list_workspaces',
        description:
          'List all Notion workspaces connected to Claude via Notion-CFS.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => {
        const lines = workspaces.map(
          (w, i) =>
            `${i + 1}. ${w.name}${w.description ? ` — ${w.description}` : ''}`
        );
        return ok(
          `Connected Notion workspaces (${workspaces.length}):\n${lines.join('\n')}`
        );
      },
    },

    // ── notion_search ─────────────────────────────────────────────────
    {
      definition: {
        name: 'notion_search',
        description:
          'Search for pages and databases across one or all connected Notion workspaces.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Full-text search query.',
            },
            workspace: {
              type: 'string',
              description: `Workspace to search: ${wsNames} — or "all" (default).`,
            },
            filter: {
              type: 'string',
              enum: ['page', 'database'],
              description: 'Restrict to pages or databases only.',
            },
            page_size: {
              type: 'number',
              description: 'Results per workspace (default 10, max 100).',
            },
          },
          required: ['query'],
        },
      },
      handler: async (args) => {
        const query = str(args.query);
        const wsName = str(args.workspace) || undefined;
        const filter = str(args.filter) as 'page' | 'database' | '';
        const pageSize = Math.min(num(args.page_size, 10), 100);

        try {
          const targets = resolveWorkspaces(workspaces, wsName);
          const sections: string[] = [];

          for (const ws of targets) {
            const res = await ws.client.search({
              query,
              filter: filter
                ? { property: 'object', value: filter }
                : undefined,
              page_size: pageSize,
            });

            if (res.results.length === 0) {
              sections.push(`[${ws.name}] No results.`);
              continue;
            }

            const lines = [`[${ws.name}] ${res.results.length} result(s):`];
            for (const item of res.results) {
              const obj = item as Record<string, unknown>;
              const title = getTitle(obj);
              const url = str(obj.url);
              lines.push(
                `  • [${item.object}] ${title}\n    ID: ${item.id}\n    URL: ${url}`
              );
            }
            if (res.has_more) lines.push('  … more results available');
            sections.push(lines.join('\n'));
          }

          return ok(sections.join('\n\n'));
        } catch (e) {
          return fail(`Search failed: ${(e as Error).message}`);
        }
      },
    },

    // ── notion_get_page ───────────────────────────────────────────────
    {
      definition: {
        name: 'notion_get_page',
        description:
          'Retrieve a Notion page (properties + block content) by its UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: {
              type: 'string',
              description: 'Page UUID (with or without dashes).',
            },
            workspace: {
              type: 'string',
              description: `Workspace that owns the page: ${wsNames}. Defaults to first.`,
            },
            include_blocks: {
              type: 'boolean',
              description: 'Include child block content (default true).',
            },
          },
          required: ['page_id'],
        },
      },
      handler: async (args) => {
        const pageId = str(args.page_id);
        const wsName = str(args.workspace) || undefined;
        const includeBlocks = bool(args.include_blocks, true);

        try {
          const target = resolveWorkspaces(workspaces, wsName)[0];
          const page = (await target.client.pages.retrieve({
            page_id: pageId,
          })) as Record<string, unknown>;

          const lines: string[] = [
            `Page ID: ${page.id}`,
            `URL: ${str(page.url)}`,
          ];

          // Properties
          if (page.properties && typeof page.properties === 'object') {
            lines.push('\nProperties:');
            for (const [key, val] of Object.entries(
              page.properties as Record<string, Record<string, unknown>>
            )) {
              const value = parseProperty(val);
              lines.push(`  ${key}: ${value}`);
            }
          }

          // Blocks
          if (includeBlocks) {
            const blocks = await target.client.blocks.children.list({
              block_id: pageId,
              page_size: 100,
            });
            lines.push('\nContent:');
            for (const block of blocks.results) {
              const b = block as Record<string, unknown>;
              const bt = str(b.type);
              const inner = b[bt] as Record<string, unknown> | undefined;
              const text =
                inner?.rich_text && Array.isArray(inner.rich_text)
                  ? richTextToPlain(
                      inner.rich_text as Array<{ plain_text: string }>
                    )
                  : '';
              lines.push(`  [${bt}] ${text}`);
            }
            if ((blocks as Record<string, unknown>).has_more) {
              lines.push('  … more blocks available');
            }
          }

          return ok(lines.join('\n'));
        } catch (e) {
          return fail(`Failed to get page: ${(e as Error).message}`);
        }
      },
    },

    // ── notion_create_page ────────────────────────────────────────────
    {
      definition: {
        name: 'notion_create_page',
        description:
          'Create a new page inside a Notion parent page or database.',
        inputSchema: {
          type: 'object',
          properties: {
            workspace: {
              type: 'string',
              description: `Target workspace: ${wsNames}. Defaults to first.`,
            },
            parent_page_id: {
              type: 'string',
              description: 'UUID of the parent page. Use this OR parent_database_id.',
            },
            parent_database_id: {
              type: 'string',
              description:
                'UUID of the parent database. Use this OR parent_page_id.',
            },
            title: {
              type: 'string',
              description: 'Title of the new page.',
            },
            content: {
              type: 'string',
              description:
                'Body text (plain). Blank lines separate paragraphs.',
            },
          },
          required: ['title'],
        },
      },
      handler: async (args) => {
        const title = str(args.title);
        const wsName = str(args.workspace) || undefined;
        const content = str(args.content) || undefined;
        const parentPageId = str(args.parent_page_id) || undefined;
        const parentDbId = str(args.parent_database_id) || undefined;

        if (!parentPageId && !parentDbId) {
          return fail('Provide either parent_page_id or parent_database_id.');
        }

        try {
          const target = resolveWorkspaces(workspaces, wsName)[0];

          const parent = parentDbId
            ? { database_id: parentDbId }
            : { page_id: parentPageId! };

          const children = content
            ? content
                .split('\n\n')
                .filter(Boolean)
                .map((para) => ({
                  object: 'block' as const,
                  type: 'paragraph' as const,
                  paragraph: {
                    rich_text: [
                      { type: 'text' as const, text: { content: para } },
                    ],
                  },
                }))
            : [];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const page = await target.client.pages.create({
            parent,
            properties: {
              title: {
                title: [{ type: 'text', text: { content: title } }],
              },
            },
            children,
          } as never);

          const p = page as Record<string, unknown>;
          return ok(
            `Page created.\nID: ${p.id}\nURL: ${str(p.url)}`
          );
        } catch (e) {
          return fail(`Failed to create page: ${(e as Error).message}`);
        }
      },
    },

    // ── notion_append_blocks ──────────────────────────────────────────
    {
      definition: {
        name: 'notion_append_blocks',
        description:
          'Append text as paragraph blocks to the end of an existing Notion page.',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: {
              type: 'string',
              description: 'UUID of the page to append to.',
            },
            workspace: {
              type: 'string',
              description: `Workspace: ${wsNames}. Defaults to first.`,
            },
            content: {
              type: 'string',
              description: 'Text to append. Blank lines separate paragraphs.',
            },
          },
          required: ['page_id', 'content'],
        },
      },
      handler: async (args) => {
        const pageId = str(args.page_id);
        const wsName = str(args.workspace) || undefined;
        const content = str(args.content);

        try {
          const target = resolveWorkspaces(workspaces, wsName)[0];
          const paras = content.split('\n\n').filter(Boolean);

          await target.client.blocks.children.append({
            block_id: pageId,
            children: paras.map((para) => ({
              object: 'block' as const,
              type: 'paragraph' as const,
              paragraph: {
                rich_text: [
                  { type: 'text' as const, text: { content: para } },
                ],
              },
            })),
          } as never);

          return ok(
            `Appended ${paras.length} paragraph(s) to page ${pageId}.`
          );
        } catch (e) {
          return fail(`Failed to append blocks: ${(e as Error).message}`);
        }
      },
    },

    // ── notion_update_page ────────────────────────────────────────────
    {
      definition: {
        name: 'notion_update_page',
        description:
          'Update the title or archived status of an existing Notion page.',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: {
              type: 'string',
              description: 'UUID of the page to update.',
            },
            workspace: {
              type: 'string',
              description: `Workspace: ${wsNames}. Defaults to first.`,
            },
            title: {
              type: 'string',
              description: 'New title to set.',
            },
            archived: {
              type: 'boolean',
              description: 'true to archive, false to unarchive.',
            },
          },
          required: ['page_id'],
        },
      },
      handler: async (args) => {
        const pageId = str(args.page_id);
        const wsName = str(args.workspace) || undefined;
        const title = str(args.title) || undefined;
        const archived =
          typeof args.archived === 'boolean' ? args.archived : undefined;

        try {
          const target = resolveWorkspaces(workspaces, wsName)[0];

          const payload: Record<string, unknown> = { page_id: pageId };
          if (archived !== undefined) payload.archived = archived;
          if (title) {
            payload.properties = {
              title: {
                title: [{ type: 'text', text: { content: title } }],
              },
            };
          }

          const page = (await target.client.pages.update(
            payload as never
          )) as Record<string, unknown>;

          return ok(`Page updated.\nID: ${page.id}`);
        } catch (e) {
          return fail(`Failed to update page: ${(e as Error).message}`);
        }
      },
    },

    // ── notion_query_database ─────────────────────────────────────────
    {
      definition: {
        name: 'notion_query_database',
        description:
          'Query a Notion database with optional filters (status, date range) and sorting. Returns full property details for each entry across any connected workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            database_id: {
              type: 'string',
              description: 'UUID of the database to query.',
            },
            workspace: {
              type: 'string',
              description: `Workspace: ${wsNames}. Defaults to first.`,
            },
            page_size: {
              type: 'number',
              description: 'Max entries to return (default 20, max 100).',
            },
            filter_status: {
              type: 'string',
              description:
                'Filter entries where a status/select property equals this value (e.g. "In Progress", "Done").',
            },
            filter_status_property: {
              type: 'string',
              description:
                'Name of the status or select property to filter on (default "Status").',
            },
            filter_assignee: {
              type: 'string',
              description:
                'Filter entries where a people property contains this person\'s name (partial match).',
            },
            filter_assignee_property: {
              type: 'string',
              description:
                'Name of the people property to filter on (default "Assignee").',
            },
            filter_date_after: {
              type: 'string',
              description:
                'ISO 8601 date (YYYY-MM-DD). Return entries with the date property after this date.',
            },
            filter_date_before: {
              type: 'string',
              description:
                'ISO 8601 date (YYYY-MM-DD). Return entries with the date property before this date.',
            },
            filter_date_property: {
              type: 'string',
              description:
                'Name of the date property to filter on (default "Date").',
            },
            sort_by: {
              type: 'string',
              description: 'Property name to sort results by.',
            },
            sort_direction: {
              type: 'string',
              enum: ['ascending', 'descending'],
              description: 'Sort direction (default "descending").',
            },
          },
          required: ['database_id'],
        },
      },
      handler: async (args) => {
        const dbId = str(args.database_id);
        const wsName = str(args.workspace) || undefined;
        const pageSize = Math.min(num(args.page_size, 20), 100);

        const filterStatus = str(args.filter_status) || undefined;
        const filterStatusProp = str(args.filter_status_property) || 'Status';
        const filterAssignee = str(args.filter_assignee) || undefined;
        const filterAssigneeProp = str(args.filter_assignee_property) || 'Assignee';
        const filterDateAfter = str(args.filter_date_after) || undefined;
        const filterDateBefore = str(args.filter_date_before) || undefined;
        const filterDateProp = str(args.filter_date_property) || 'Date';
        const sortBy = str(args.sort_by) || undefined;
        const sortDir = (str(args.sort_direction) || 'descending') as 'ascending' | 'descending';

        try {
          const target = resolveWorkspaces(workspaces, wsName)[0];

          // Build compound filter
          const andClauses: unknown[] = [];

          if (filterStatus) {
            // Try both status and select property types
            andClauses.push({
              or: [
                { property: filterStatusProp, status: { equals: filterStatus } },
                { property: filterStatusProp, select: { equals: filterStatus } },
              ],
            });
          }

          if (filterDateAfter) {
            andClauses.push({
              property: filterDateProp,
              date: { after: filterDateAfter },
            });
          }

          if (filterDateBefore) {
            andClauses.push({
              property: filterDateProp,
              date: { before: filterDateBefore },
            });
          }

          const filter =
            andClauses.length === 1
              ? andClauses[0]
              : andClauses.length > 1
                ? { and: andClauses }
                : undefined;

          const sorts = sortBy
            ? [{ property: sortBy, direction: sortDir }]
            : undefined;

          const res = await target.client.databases.query({
            database_id: dbId,
            page_size: pageSize,
            filter: filter as never,
            sorts: sorts as never,
          });

          // Post-filter by assignee name (Notion API requires user ID for people filters)
          const results = filterAssignee
            ? res.results.filter((item: Record<string, unknown>) => {
                const obj = item as Record<string, unknown>;
                const props = obj.properties as Record<string, Record<string, unknown>> | undefined;
                if (!props) return false;
                const peopleProp = props[filterAssigneeProp];
                if (!peopleProp) return false;
                const people = peopleProp.people as Array<Record<string, unknown>> | undefined;
                return people?.some((p) =>
                  str(p.name).toLowerCase().includes(filterAssignee.toLowerCase())
                ) ?? false;
              })
            : res.results;

          const lines = [
            `Database ${dbId} [${target.name}]: ${results.length} entr${results.length === 1 ? 'y' : 'ies'}`,
          ];

          for (const item of results) {
            const obj = item as Record<string, unknown>;
            const title = getTitle(obj);
            lines.push(`\n• ${title}`);
            lines.push(`  ID: ${item.id}`);

            // Show all non-empty properties
            if (obj.properties && typeof obj.properties === 'object') {
              for (const [key, val] of Object.entries(
                obj.properties as Record<string, Record<string, unknown>>
              )) {
                if (val.type === 'title') continue;
                const value = parseProperty(val);
                if (value) lines.push(`  ${key}: ${value}`);
              }
            }
          }

          if (res.has_more) lines.push('\n… more entries available (increase page_size or narrow filters)');

          return ok(lines.join('\n'));
        } catch (e) {
          return fail(`Failed to query database: ${(e as Error).message}`);
        }
      },
    },
  ];
}
