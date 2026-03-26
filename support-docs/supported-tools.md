> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Supported tools

> Learn what you can do with Notion MCP tools.

Now that you have installed the Notion MCP, let's explore how AI assistants can use Notion MCP tools to create, search, and manage content in your Notion workspace.

These tools work seamlessly together through prompts, and their real power comes from combining them. With a single prompt, you can search your workspace, create new pages from the results, and update properties across multiple pages. Understanding these building blocks helps you craft efficient prompts that tackle complex tasks by combining multiple tools.

## MCP tools

<AccordionGroup>
  <Accordion title="Search Notion and connected sources">
    `notion-search`

    Search across your Notion workspace and connected tools like Slack, Google Drive, and Jira.

    <Note>
      Requires Notion AI access. Without a Notion AI plan, search is limited to your Notion workspace only.
    </Note>

    **Example prompts:**

    * "Check Slack for how we solved this bug in the past"
    * "Search for documents mentioning 'budget approval process'"
    * "Look for meeting notes from last week with John"
    * "Find all project pages that mention 'ready for dev'"
  </Accordion>

  <Accordion title="Fetch Notion content">
    `notion-fetch`

    Retrieves content from a Notion page, database, or data source by its URL or ID. You can pass a data source ID (from `collection://...` tags in database responses) to fetch details about that specific data source, including its schema and properties. When fetching a database, the response includes available templates for each data source, which can be used with the create-pages and update-page tools.

    **Example prompts:**

    * "What product requirements still need to be implemented from this ticket `https://notion.so/page-url`?"
    * "Fetch the data source `collection://f336d0bc-b841-465b-8045-024475c079dd` to see its schema"
    * "Fetch the bug tracking database so I can see the available templates"
  </Accordion>

  <Accordion title="Create pages">
    `notion-create-pages`

    Creates one or more Notion pages with specified properties and content. Supports applying [database templates](/guides/data-apis/creating-pages-from-templates) to pre-populate new pages with content and property values. Each page can optionally have an icon (emoji, custom emoji by name, or external URL) and a cover image. If a parent is not specified, a private page will be created.

    **Example prompts:**

    * "Create a project kickoff page under our Projects folder with agenda and team info"
    * "Make a new employee onboarding checklist in our HR database"
    * "Create a new bug report in the tracking database using the 'Urgent Bug' template"
    * "Add a new product feature request to our feature database"
    * "Create a page with the 🚀 icon and a cover image"
  </Accordion>

  <Accordion title="Update a page">
    `notion-update-page`

    Update a Notion page's properties, content, icon, or cover. Supports applying [database templates](/guides/data-apis/creating-pages-from-templates) to existing pages. Icon and cover can be set alongside any update command.

    **Example prompts:**

    * "Change the status of this task from 'In Progress' to 'Complete'"
    * "Add a new section about risks to the project plan page"
    * "Apply the project kickoff template to this page"
    * "Set the page icon to 🎯 and add a cover image"
    * "Remove the icon from this page"
  </Accordion>

  <Accordion title="Move pages">
    `notion-move-pages`

    Move one or more Notion pages or databases to a new parent.

    **Example prompts:**

    * "Move my weekly meeting notes page to the 'Team Meetings' page"
    * "Reorganize all project documents under the 'Active Projects' section"
  </Accordion>

  <Accordion title="Duplicate a page">
    `notion-duplicate-page`

    Duplicate a Notion page within your workspace. This action completes asynchronously.

    **Example prompts:**

    * "Duplicate my project template page so I can use it for the new Q3 initiative"
    * "Make a copy of the meeting agenda template for next week's planning session"
  </Accordion>

  <Accordion title="Create a database">
    `notion-create-database`

    Creates a new Notion database, initial data source, and initial view with the specified properties.

    **Example prompts:**

    * "Create a new database to track our customer feedback with fields for customer name, feedback type, priority, and status"
    * "Set up a content calendar database with columns for publish date, content type, and approval status"
  </Accordion>

  <Accordion title="Update a data source">
    `notion-update-data-source`

    Update a Notion data source's properties, name, description, or other attributes.

    **Example prompts:**

    * "Add a status field to track project completion"
    * "Update the task database to include priority levels"
  </Accordion>

  <Accordion title="Create a view">
    `notion-create-view`

    Create a new view on a Notion database. Supports table, board, list, calendar, timeline, gallery, form, chart, map, and dashboard view types. Use the optional configuration DSL for filters, sorts, grouping, and display options.

    **Example prompts:**

    * "Create a board view grouped by Status in my tasks database"
    * "Add a calendar view to the project tracker that shows items by due date"
    * "Set up a filtered table view that only shows in-progress items, sorted by priority"
    * "Create a timeline view for the roadmap database using start and end dates"
    * "Create a chart view showing task counts by status as a bar chart"
    * "Add a form view to the feedback database for collecting responses"
    * "Create a map view of office locations using the Address property"
  </Accordion>

  <Accordion title="Update a view">
    `notion-update-view`

    Update a view's name, filters, sorts, or display configuration. Only the fields you specify will be changed. Supports clearing existing configuration like filters, sorts, and grouping.

    **Example prompts:**

    * "Rename the 'All Tasks' view to 'Sprint Board'"
    * "Update the board view to filter by status equals 'Done'"
    * "Clear the filters on this view and add a sort by created date"
    * "Change the view to group by priority and only show Name and Status columns"
  </Accordion>

  <Accordion title="Query across data sources">
    `notion-query-data-sources`

    Query across multiple Notion data sources directly with structured summaries, grouping, and filters. Returns organized results with counts and rollups for quick scanning.

    <Note>
      Requires Enterprise plan with Notion AI.
    </Note>

    **Example prompts:**

    * "What's due for me this week across all tasks and meeting note action items? Group by priority."
    * "Show all risks from Engineering and Product databases this month, grouped by owner."
  </Accordion>

  <Accordion title="Query a database view">
    `notion-query-database-view`

    Query data from a Notion database using a pre-defined [view's filters and sorts](https://www.notion.com/help/views-filters-and-sorts).

    <Note>
      Requires Business plan or higher with Notion AI. Only available when the `notion-query-data-sources` tool is not available.
    </Note>

    **Example prompts:**

    * "Query my 'In Progress' tasks view to see what I'm currently working on"
    * "Get all items from the 'High Priority' view in our feature requests database"
    * "Export the filtered data from the 'Q1 Goals' view for analysis"
  </Accordion>

  <Accordion title="Add a comment">
    `notion-create-comment`

    Add a comment to a page or specific content. Supports page-level comments,
    block-level comments (via content selection), and replies to existing discussions.

    **Example prompts:**

    * "Add a feedback comment to this design proposal"
    * "Comment on the 'Budget' section of the quarterly review"
    * "Reply to the discussion about deadline concerns"
    * "Leave a note on the meeting notes about the action items"
  </Accordion>

  <Accordion title="Get comments">
    `notion-get-comments`

    Lists all comments and discussions on a page. Can include block-level and
    inline discussions, resolved threads, and full comment content.

    **Example prompts:**

    * "Get all discussions on this page, including resolved ones"
    * "Show me the comments on the Requirements section"
    * "Get all feedback comments from last week's review"
  </Accordion>

  <Accordion title="Get teams">
    `notion-get-teams`

    Retrieves a list of teams (teamspaces) in the current workspace.

    **Example prompts:**

    * "Search for teams by name, and your membership status in each team"
    * "Get a team's ID to use as a filter for a search"
  </Accordion>

  <Accordion title="List users">
    `notion-get-users`

    Lists all users in the workspace with their details.

    **Example prompts:**

    * "Get contact details for the user who created this page"
    * "Look up the profile of the person assigned to this task"
  </Accordion>

  <Accordion title="Get current user">
    `notion-get-user`

    Retrieve your user information by ID.

    **Example prompts:**

    * "What's my email address?"
    * "What's my Notion user ID?"
  </Accordion>

  <Accordion title="Get bot info">
    `notion-get-self`

    Retrieves information about your own bot user and the Notion workspace you're connected to.

    **Example prompts:**

    * "Which Notion workspace am I currently connected to?"
    * "What's my file size upload limit for the current workspace?"
  </Accordion>
</AccordionGroup>

<Info>
  **Tool names may vary for OpenAI**

  When connecting with an OpenAI MCP client (e.g. ChatGPT), the `notion-` prefix is automatically omitted from the `notion-fetch` and `notion-search` tools, making them appear as `fetch` and `search`, respectively. This is because these specific tool names are required as part of the [Deep Research specification](https://platform.openai.com/docs/guides/deep-research#remote-mcp-servers) for remote MCP servers.
</Info>

## Rate limits

Standard [API request limits](/reference/request-limits) apply per user's usage of Notion MCP (totaled across all tool calls). Currently, this is an average of **180 requests per minute** (3 requests per second).

Some MCP tools have additional, tool-specific rate limits that are stricter. These are subject to change over time, but the current values are listed below for reference:

* **Search**: 30 requests per minute

### Examples

To illustrate the above limitations, you'll experience rate limit errors in your MCP client of choice in any of the following example scenarios (assuming we take the average rate over a large enough time window):

* 35 searches per minute (exceeds search-specific limit)
* 12 searches & 170 fetches per minute (exceeds general 180 requests/min limit)
* 185 fetches per minute (exceeds general 180 requests/min limit)

### What to do if you're rate-limited

In most cases, the time it takes to do a complex AI-powered search across Notion and your connected tools means that sequential searches will typically stay under the rate limit. In general, if you encounter rate limit errors, prompt your LLM tool to reduce the amount of parallel searches or operations performed using Notion MCP, and/or try again later.


Built with [Mintlify](https://mintlify.com).