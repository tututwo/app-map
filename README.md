# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Interview access protection

The optional access gate is disabled by default, so deployments without its variables remain public.
For the interview site, configure these private variables in the
`church-closing-interviews` Vercel project:

| Variable                      | Value                                                                     |
| ----------------------------- | ------------------------------------------------------------------------- |
| `DASHBOARD_ACCESS_PROTECTION` | `true` to enable; `false` or unset to disable                             |
| `DASHBOARD_ACCESS_CODE`       | A generated, case-sensitive code with at least 8 characters               |
| `DASHBOARD_SESSION_SECRET`    | A random secret with at least 32 bytes, such as `openssl rand -base64 48` |

Set them only for the interview project's **Production** environment. Its stable interview URL is
the production alias of that separate Vercel project; the official `church-closing-dashboard`
project must not receive these variables.

Changing `DASHBOARD_ACCESS_CODE` or `DASHBOARD_SESSION_SECRET` invalidates existing sessions after
the interview project is redeployed. Changing the enable flag also requires a redeploy. Do not use
`PUBLIC_`-prefixed variables for either secret. Keep access codes high-entropy rather than using a
word or familiar phrase; `openssl rand -hex 12` is a suitable generator.

The deployment branch is `interview-preview-2026-07-30`. Keep the access-gate changes on that
branch and do not merge them into `main` unless the official-site behavior is intentionally being
changed.
