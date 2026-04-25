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

    // ── notion_verify_access ──────────────────────────────────────────
    {
      definition: {
        name: 'notion_verify_access',
        description:
          'Verify that Claude can reach each configured Notion workspace by calling the Notion API. Reports success or failure per workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            workspace: {
              type: 'string',
              description: `Workspace to verify: ${wsNames} — or "all" (default).`,
            },
          },
        },
      },
      handler: async (args) => {
        const wsName = str(args.workspace) || undefined;
        const targets = resolveWorkspaces(workspaces, wsName);

        const lines: string[] = [
          `Verifying access to ${targets.length === workspaces.length ? 'all' : targets.length} workspace(s)…`,
          '',
        ];

        let successCount = 0;
        for (const ws of targets) {
          try {
            const me = await ws.client.users.me({}) as Record<string, unknown>;
            const botName = str((me as Record<string, unknown>).name) || '(unnamed bot)';
            const wsInfo = (me as Record<string, unknown>).bot as Record<string, unknown> | undefined;
            const notionWsName = wsInfo?.workspace_name
              ? str(wsInfo.workspace_name)
              : undefined;
            lines.push(
              `  ✓ ${ws.name}${ws.description ? ` (${ws.description})` : ''}` +
              ` — bot: ${botName}` +
              (notionWsName ? ` | Notion workspace: ${notionWsName}` : '')
            );
            successCount++;
          } catch (e) {
            lines.push(
              `  ✗ ${ws.name}${ws.description ? ` (${ws.description})` : ''}` +
              ` — ERROR: ${(e as Error).message}`
            );
          }
        }

        lines.push('');
        lines.push(`Result: ${successCount}/${targets.length} workspace(s) accessible.`);
        return ok(lines.join('\n'));
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
              let value = '';
              switch (val.type) {
                case 'title':
                  value = richTextToPlain(
                    val.title as Array<{ plain_text: string }>
                  );
                  break;
                case 'rich_text':
                  value = richTextToPlain(
                    val.rich_text as Array<{ plain_text: string }>
                  );
                  break;
                case 'select':
                  value = str((val.select as Record<string, unknown>)?.name);
                  break;
                case 'multi_select':
                  value = (
                    val.multi_select as Array<{ name: string }>
                  )
                    .map((o) => o.name)
                    .join(', ');
                  break;
                case 'checkbox':
                  value = String(val.checkbox);
                  break;
                case 'date':
                  value = str(
                    (val.date as Record<string, unknown>)?.start
                  );
                  break;
                case 'number':
                  value = String(val.number ?? '');
                  break;
                case 'status':
                  value = str(
                    (val.status as Record<string, unknown>)?.name
                  );
                  break;
                default:
                  value = `(${val.type})`;
              }
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
          'Query a Notion database and list its entries (titles and IDs).',
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
          },
          required: ['database_id'],
        },
      },
      handler: async (args) => {
        const dbId = str(args.database_id);
        const wsName = str(args.workspace) || undefined;
        const pageSize = Math.min(num(args.page_size, 20), 100);

        try {
          const target = resolveWorkspaces(workspaces, wsName)[0];
          const res = await target.client.databases.query({
            database_id: dbId,
            page_size: pageSize,
          });

          const lines = [
            `Database ${dbId}: ${res.results.length} entr${res.results.length === 1 ? 'y' : 'ies'}`,
          ];
          for (const item of res.results) {
            const obj = item as Record<string, unknown>;
            const title = getTitle(obj);
            lines.push(`  • ${title} [${item.id}]`);
          }
          if (res.has_more) lines.push('  … more entries available');

          return ok(lines.join('\n'));
        } catch (e) {
          return fail(`Failed to query database: ${(e as Error).message}`);
        }
      },
    },

    // ── notion_report_tasks ───────────────────────────────────────────
    {
      definition: {
        name: 'notion_report_tasks',
        description:
          'Generate a structured task report from a Notion database. Supports filtering by status, due date window, and overdue detection. Marks overdue items automatically.',
        inputSchema: {
          type: 'object',
          properties: {
            database_id: {
              type: 'string',
              description: 'UUID of the tasks database to report on.',
            },
            workspace: {
              type: 'string',
              description: `Workspace that owns the database: ${wsNames}. Defaults to first.`,
            },
            status: {
              type: 'string',
              description:
                'Filter by a specific status value (e.g. "In Progress", "To Do"). Omit to include all statuses.',
            },
            status_property: {
              type: 'string',
              description: 'Name of the status property in the database (default: "Status").',
            },
            date_property: {
              type: 'string',
              description: 'Name of the due-date property in the database (default: "Due Date").',
            },
            overdue_only: {
              type: 'boolean',
              description: 'When true, return only tasks whose due date is in the past.',
            },
            due_within_days: {
              type: 'number',
              description: 'Return tasks due within the next N days (inclusive of today).',
            },
            page_size: {
              type: 'number',
              description: 'Max tasks to return (default 50, max 100).',
            },
          },
          required: ['database_id'],
        },
      },
      handler: async (args) => {
        const dbId = str(args.database_id);
        const wsName = str(args.workspace) || undefined;
        const statusFilter = str(args.status) || undefined;
        const statusProp = str(args.status_property) || 'Status';
        const dateProp = str(args.date_property) || 'Due Date';
        const overdueOnly = bool(args.overdue_only, false);
        const dueWithinDays =
          typeof args.due_within_days === 'number'
            ? args.due_within_days
            : undefined;
        const pageSize = Math.min(num(args.page_size, 50), 100);

        try {
          const target = resolveWorkspaces(workspaces, wsName)[0];

          const today = new Date().toISOString().split('T')[0];
          const filters: object[] = [];

          if (statusFilter) {
            filters.push({ property: statusProp, status: { equals: statusFilter } });
          }

          if (overdueOnly) {
            filters.push({ property: dateProp, date: { before: today } });
          } else if (dueWithinDays !== undefined) {
            const future = new Date();
            future.setDate(future.getDate() + dueWithinDays);
            const futureStr = future.toISOString().split('T')[0];
            filters.push({ property: dateProp, date: { on_or_before: futureStr } });
          }

          const queryParams: Record<string, unknown> = {
            database_id: dbId,
            page_size: pageSize,
            sorts: [{ property: dateProp, direction: 'ascending' }],
          };

          if (filters.length === 1) queryParams.filter = filters[0];
          else if (filters.length > 1) queryParams.filter = { and: filters };

          const res = await target.client.databases.query(
            queryParams as never
          );

          if (res.results.length === 0) {
            return ok('No tasks found matching the given filters.');
          }

          const lines: string[] = [
            `Task Report — ${target.name}${target.description ? ` (${target.description})` : ''}`,
            `Database: ${dbId}`,
            `Tasks: ${res.results.length}${res.has_more ? '+' : ''}`,
            '',
          ];

          for (const item of res.results) {
            const obj = item as Record<string, unknown>;
            const props =
              (obj.properties as Record<
                string,
                Record<string, unknown>
              >) ?? {};
            const title = getTitle(obj);

            let statusVal = '';
            let dueVal = '';
            let assigneeVal = '';

            const sp = props[statusProp];
            if (sp?.type === 'status' && sp.status) {
              statusVal = str(
                (sp.status as Record<string, unknown>).name
              );
            } else if (sp?.type === 'select' && sp.select) {
              statusVal = str(
                (sp.select as Record<string, unknown>).name
              );
            }

            const dp = props[dateProp];
            if (dp?.type === 'date' && dp.date) {
              dueVal = str((dp.date as Record<string, unknown>).start);
            }

            const assigneeProp =
              props['Assignee'] ??
              props['Assigned To'] ??
              props['Owner'];
            if (assigneeProp?.type === 'people') {
              assigneeVal = (
                assigneeProp.people as Array<Record<string, unknown>>
              )
                .map((p) => str(p.name))
                .filter(Boolean)
                .join(', ');
            }

            const isOverdue = dueVal ? dueVal < today : false;
            const meta: string[] = [];
            if (statusVal) meta.push(`Status: ${statusVal}`);
            if (dueVal)
              meta.push(`Due: ${dueVal}${isOverdue ? ' [OVERDUE]' : ''}`);
            if (assigneeVal) meta.push(`Assignee: ${assigneeVal}`);

            lines.push(`• ${title}`);
            if (meta.length) lines.push(`  ${meta.join(' | ')}`);
            lines.push(`  ID: ${item.id}`);
          }

          if (res.has_more)
            lines.push(
              '\n… more tasks available — increase page_size or apply filters to narrow results.'
            );

          return ok(lines.join('\n'));
        } catch (e) {
          return fail(
            `Failed to generate task report: ${(e as Error).message}`
          );
        }
      },
    },
  ];
}
