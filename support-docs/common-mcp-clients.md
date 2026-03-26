> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Common MCP clients

These AI tools support MCP and can connect to Notion.

<CardGroup>
  <Card title="Claude Code" href="https://docs.anthropic.com/en/docs/claude-code/mcp" icon="angles-right" horizontal color="#0076d7" />

  <Card title="Cursor" href="https://docs.cursor.com/context/mcp" icon="angles-right" horizontal color="#0076d7" />

  <Card title="VS Code" href="https://code.visualstudio.com/docs/copilot/customization/mcp-servers" icon="angles-right" horizontal color="#0076d7" />

  <Card title="Claude Desktop" href="https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers" icon="angles-right" horizontal color="#0076d7" />

  <Card title="Windsurf" href="https://docs.windsurf.com/windsurf/cascade/mcp" icon="angles-right" horizontal color="#0076d7" />

  <Card title="ChatGPT" href="https://help.openai.com/en/articles/11487775-connectors-in-chatgpt" icon="angles-right" horizontal color="#0076d7" />

  <Card title="Codex" href="https://developers.openai.com/codex/mcp" icon="angles-right" horizontal color="#0076d7" />
# Model Context Protocol

Model Context Protocol (MCP) connects models to tools and context. Use it to give Codex access to third-party documentation, or to let it interact with developer tools like your browser or Figma.

Codex supports MCP servers in both the CLI and the IDE extension.

## Supported MCP features

- **STDIO servers**: Servers that run as a local process (started by a command).
  - Environment variables
- **Streamable HTTP servers**: Servers that you access at an address.
  - Bearer token authentication
  - OAuth authentication (run `codex mcp login <server-name>` for servers that support OAuth)

## Connect Codex to an MCP server

Codex stores MCP configuration in `config.toml` alongside other Codex configuration settings. By default this is `~/.codex/config.toml`, but you can also scope MCP servers to a project with `.codex/config.toml` (trusted projects only).

The CLI and the IDE extension share this configuration. Once you configure your MCP servers, you can switch between the two Codex clients without redoing setup.

To configure MCP servers, choose one option:

1. **Use the CLI**: Run `codex mcp` to add and manage servers.
2. **Edit `config.toml`**: Update `~/.codex/config.toml` (or a project-scoped `.codex/config.toml` in trusted projects) directly.

### Configure with the CLI

#### Add an MCP server

```bash
codex mcp add <server-name> --env VAR1=VALUE1 --env VAR2=VALUE2 -- <stdio server-command>
```

For example, to add Context7 (a free MCP server for developer documentation), you can run the following command:

```bash
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

#### Other CLI commands

To see all available MCP commands, you can run `codex mcp --help`.

#### Terminal UI (TUI)

In the `codex` TUI, use `/mcp` to see your active MCP servers.

### Configure with config.toml

For more fine-grained control over MCP server options, edit `~/.codex/config.toml` (or a project-scoped `.codex/config.toml`). In the IDE extension, select **MCP settings** > **Open config.toml** from the gear menu.

Configure each MCP server with a `[mcp_servers.<server-name>]` table in the configuration file.

#### STDIO servers

- `command` (required): The command that starts the server.
- `args` (optional): Arguments to pass to the server.
- `env` (optional): Environment variables to set for the server.
- `env_vars` (optional): Environment variables to allow and forward.
- `cwd` (optional): Working directory to start the server from.

#### Streamable HTTP servers

- `url` (required): The server address.
- `bearer_token_env_var` (optional): Environment variable name for a bearer token to send in `Authorization`.
- `http_headers` (optional): Map of header names to static values.
- `env_http_headers` (optional): Map of header names to environment variable names (values pulled from the environment).

#### Other configuration options

- `startup_timeout_sec` (optional): Timeout (seconds) for the server to start. Default: `10`.
- `tool_timeout_sec` (optional): Timeout (seconds) for the server to run a tool. Default: `60`.
- `enabled` (optional): Set `false` to disable a server without deleting it.
- `required` (optional): Set `true` to make startup fail if this enabled server can't initialize.
- `enabled_tools` (optional): Tool allow list.
- `disabled_tools` (optional): Tool deny list (applied after `enabled_tools`).

If your OAuth provider requires a fixed callback port, set the top-level `mcp_oauth_callback_port` in `config.toml`. If unset, Codex binds to an ephemeral port.

If your MCP OAuth flow must use a specific callback URL (for example, a remote devbox ingress URL or a custom callback path), set `mcp_oauth_callback_url`. Codex uses this value as the OAuth `redirect_uri` while still using `mcp_oauth_callback_port` for the callback listener port. Local callback URLs (for example `localhost`) bind on loopback; non-local callback URLs bind on `0.0.0.0` so the callback can reach the host.

If the MCP server advertises `scopes_supported`, Codex prefers those
server-advertised scopes during OAuth login. Otherwise, Codex falls back to the
scopes configured in `config.toml`.

#### config.toml examples

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.context7.env]
MY_ENV_VAR = "MY_ENV_VALUE"
```

```toml
# Optional MCP OAuth callback overrides (used by `codex mcp login`)
mcp_oauth_callback_port = 5555
mcp_oauth_callback_url = "https://devbox.example.internal/callback"
```

```toml
[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { "X-Figma-Region" = "us-east-1" }
```

```toml
[mcp_servers.chrome_devtools]
url = "http://localhost:3000/mcp"
enabled_tools = ["open", "screenshot"]
disabled_tools = ["screenshot"] # applied after enabled_tools
startup_timeout_sec = 20
tool_timeout_sec = 45
enabled = true
```

## Examples of useful MCP servers

The list of MCP servers keeps growing. Here are a few common ones:

- [OpenAI Docs MCP](https://developers.openai.com/learn/docs-mcp): Search and read OpenAI developer docs.
- [Context7](https://github.com/upstash/context7): Connect to up-to-date developer documentation.
- Figma [Local](https://developers.figma.com/docs/figma-mcp-server/local-server-installation/) and [Remote](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/): Access your Figma designs.
- [Playwright](https://www.npmjs.com/package/@playwright/mcp): Control and inspect a browser using Playwright.
- [Chrome Developer Tools](https://github.com/ChromeDevTools/chrome-devtools-mcp/): Control and inspect Chrome.
- [Sentry](https://docs.sentry.io/product/sentry-mcp/#codex): Access Sentry logs.
- [GitHub](https://github.com/github/github-mcp-server): Manage GitHub beyond what `git` supports (for example, pull requests and issues).






  <Card title="Antigravity" href="https://antigravity.google/docs/mcp" icon="angles-right" horizontal color="#0076d7" />
</CardGroup>
Antigravity Editor: MCP Integration

Antigravity supports the Model Context Protocol (MCP), a standard that allows the editor to securely connect to your local tools, databases, and external services. This integration provides the AI with real-time context beyond just the files open in your editor.
What is MCP?

MCP acts as a bridge between Antigravity and your broader development environment. Instead of manually pasting context (like database schemas or logs) into the editor, MCP allows Antigravity to fetch this information directly when needed.
Core Features
1. Context Resources

The AI can read data from connected MCP servers to inform its suggestions.

Example: When writing a SQL query, Antigravity can inspect your live Neon or Supabase schema to suggest correct table and column names.

Example: When debugging, the editor can pull in recent build logs from Netlify or Heroku.
2. Custom Tools

MCP enables Antigravity to execute specific, safe actions defined by your connected servers.

Example: "Create a Linear issue for this TODO."

Example: "Search Notion or GitHub for authentication patterns."
How to Connect

Connections are managed directly through the built-in MCP Store.

    Access the Store: Open the MCP Store panel within the "..." dropdown at the top of the editor's side panel.
    Browse & Install: Select any of the supported servers from the list and click Install.
    Authenticate: Follow the on-screen prompts to securely link your accounts (where applicable).

Once installed, resources and tools from the server are automatically available to the editor.
Connecting Custom MCP Servers

To connect to a custom MCP server:

    Open the MCP store via the "..." dropdown at the top of the editor's agent panel.
    Click on "Manage MCP Servers"
    Click on "View raw config"
    Modify the mcp_config.json with your custom MCP server configuration.

Supported Servers

The MCP Store currently features integrations for:

    Airweave
    Arize
    AlloyDB for PostgreSQL
    Atlassian
    BigQuery
    Cloud SQL for PostgreSQL
    Cloud SQL for MySQL
    Cloud SQL for SQL Server
    Dart
    Dataplex
    Figma Dev Mode MCP
    Firebase
    GitHub
    Harness
    Heroku
    Linear
    Locofy
    Looker
    MCP Toolbox for Databases
    MongoDB
    Neon
    Netlify
    Notion
    PayPal
    Perplexity Ask
    Pinecone
    Prisma
    Redis
    Sequential Thinking
    SonarQube
    Spanner
    Stripe
    Supabase

To connect to the [remote Notion MCP](/guides/mcp/mcp), many of these tools offer built-in directories or marketplaces where you can add **Notion**. For more setup instructions, see [Connecting to Notion MCP](/guides/mcp/get-started-with-mcp).

For the [local MCP server](/guides/mcp/hosting-open-source-mcp), see the [README for connection instructions](https://github.com/makenotion/notion-mcp-server?tab=readme-ov-file#3-adding-mcp-config-to-your-client).

<Note>
  Building your own MCP client? See the [MCP client integration guide](https://github.com/makenotion/notion-cookbook/blob/main/docs/mcp-client-integration.md) for step-by-step instructions on implementing OAuth and connecting to Notion MCP.
</Note>


Built with [Mintlify](https://mintlify.com).