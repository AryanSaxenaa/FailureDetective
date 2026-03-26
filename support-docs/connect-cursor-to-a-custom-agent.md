> ## Documentation Index
> Fetch the complete documentation index at: https://developers.notion.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Connect Cursor to a custom agent

> Learn how to connect Cursor to a Notion custom agent so it can build features, fix bugs, and open pull requests from Notion tasks.

<Warning>
  This feature is currently in **beta**. The setup flow and capabilities may change.
</Warning>

This guide walks you through connecting [Cursor](https://cursor.com) to a Notion custom agent. Once connected, your agent can turn a page, task, or comment into working code and a pull request — and it can keep running in the background while you move on to other work.

With this integration, you can:

* **Create PRs from Notion** — Start a pull request from a page, task, or comment
* **Fix bugs from tasks** — Point the agent at a bug report and let it produce a fix
* **Run in the background** — Close the page and come back later to find a PR link waiting

## Prerequisites

Before you start, make sure you have:

* A [custom agent](https://www.notion.com/help/custom-agent) in your Notion workspace
* A [Cursor](https://cursor.com) account (logging in with GitHub gives the easiest setup)

During setup, you'll create a **Cursor User API Key** and paste it into Notion.

## Set up the connection

### 1. Add the Cursor connection in Notion

<Steps>
  <Step>
    Open the custom agent you want to connect.
  </Step>

  <Step>
    Open the agent's **Settings**.
  </Step>

  <Step>
    In **Tools & access**, click **Add connection**.

        <img src="https://mintcdn.com/notion-demo/OSeEitqkonP_Uquz/images/docs/agents/add-connection.png?fit=max&auto=format&n=OSeEitqkonP_Uquz&q=85&s=85bb0c46f1bd572227591529dfd0e638" alt="Add connection button in the agent's Tools & access settings" width="1024" height="442" data-path="images/docs/agents/add-connection.png" />
  </Step>

  <Step>
    Select **Cursor** from the dropdown and click **Connect**.

        <img src="https://mintcdn.com/notion-demo/73h1plHuqNYr4i7q/images/docs/agents/select-cursor.png?fit=max&auto=format&n=73h1plHuqNYr4i7q&q=85&s=8aad827a404023e30b1eca8352462064" alt="Selecting Cursor from the connection dropdown" width="1024" height="695" data-path="images/docs/agents/select-cursor.png" />
  </Step>
</Steps>

### 2. Create a User API Key in Cursor

<Steps>
  <Step>
    Log in to [cursor.com](https://cursor.com).

    <Tip>
      For the easiest setup, log in with GitHub. If you log in another way, connect GitHub to your Cursor account first.
    </Tip>
  </Step>

  <Step>
    Open the [Integrations tab](https://cursor.com/dashboard?tab=integrations) in your Cursor dashboard.
  </Step>

  <Step>
    Create a new **User API Key** and copy it.

        <img src="https://mintcdn.com/notion-demo/OSeEitqkonP_Uquz/images/docs/agents/cursor-api-token.png?fit=max&auto=format&n=OSeEitqkonP_Uquz&q=85&s=69dbca63e812ceaf193eaf8f5a9f0a43" alt="Creating a User API Key in the Cursor dashboard" width="1024" height="756" data-path="images/docs/agents/cursor-api-token.png" />
  </Step>
</Steps>

### 3. Finish the connection in Notion

<Steps>
  <Step>
    Return to Notion and paste your Cursor User API Key into the connection modal, then click **Connect**.

        <img src="https://mintcdn.com/notion-demo/OSeEitqkonP_Uquz/images/docs/agents/paste-token.png?fit=max&auto=format&n=OSeEitqkonP_Uquz&q=85&s=8eba4dd14b51a9f1befea8252a20c69f" alt="Pasting the Cursor API token into the Notion connection modal" width="1024" height="789" data-path="images/docs/agents/paste-token.png" />
  </Step>

  <Step>
    Share the pages and databases your agent needs to read. This typically includes your engineering task database and any spec pages the agent should reference.

        <img src="https://mintcdn.com/notion-demo/73h1plHuqNYr4i7q/images/docs/agents/share-pages.png?fit=max&auto=format&n=73h1plHuqNYr4i7q&q=85&s=cb3e4217462db31c7fdf3e165b0bfc7e" alt="Sharing pages and databases with the agent" width="860" height="1024" data-path="images/docs/agents/share-pages.png" />
  </Step>

  <Step>
    Save your changes to the agent.
  </Step>
</Steps>

Cursor is now connected and your agent can write code and open pull requests directly from your tasks or agent chat.

## Using the agent

There are two ways to hand work to your agent:

* **Assign a database page** (like a task) to the agent
* **@mention the agent** in a comment on a page or task

When you do, be direct about what you want it to build and where the work should land. For example:

* *"Create a PR from this spec in \[repo URL]"*
* *"Start this in the background, then open a PR when it's ready."*
* *"Fix the bug described in this task and update the task."*

<img src="https://mintcdn.com/notion-demo/OSeEitqkonP_Uquz/images/docs/agents/assign-task.png?fit=max&auto=format&n=OSeEitqkonP_Uquz&q=85&s=9dc44e0347b50d6e8e45e26e71af8378" alt="Assigning a task to the agent with a clear instruction" width="1024" height="583" data-path="images/docs/agents/assign-task.png" />

Your agent can keep working after you close the page or agent chat. To check on progress, open the agent and look at its chat activity for status updates and links.

## Troubleshooting

<AccordionGroup>
  <Accordion title="Can't find progress updates">
    Progress lives in the agent's **chat activity**, even if you started the work from a task comment. Open the agent to see status updates and PR links.
  </Accordion>

  <Accordion title="Updates feel scattered">
    Use the agent's **chat** when you want a single thread of status updates. Use **task comments** when you want the work to stay attached to a specific page.
  </Accordion>

  <Accordion title="Cursor can't see what you're referencing">
    Share the relevant pages and databases with the agent so it can read the spec, task, and any linked context. You can update shared pages in the agent's **Settings** → **Tools & access**.
  </Accordion>

  <Accordion title="Nothing happens after assigning a task">
    Give it a minute, then confirm:

    * Cursor is connected (check **Settings** → **Tools & access**)
    * Your API key is still valid
    * The agent has access to the task and any referenced pages
  </Accordion>

  <Accordion title="Rotated your API key and things fail">
    Reconnect Cursor in **Tools & access** using a fresh API key. The old key is no longer valid after rotation.
  </Accordion>
</AccordionGroup>


Built with [Mintlify](https://mintlify.com).