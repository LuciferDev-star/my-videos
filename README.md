# Video Editor

A guided web editor for assembling AI-generated clips (dropped in an S3 bucket, or uploaded/dragged in directly through this app) into a final stitched video, built on Remotion. Clips are picked into the timeline through plain UI controls; from there, edits (trim, reorder, captions, transitions) can be made either through those same controls or by typing free-form instructions into the prompt box, understood by Gemini (`GEMINI_API_KEY`) - or, with no key configured, a fixed set of deterministic phrasings, zero AI/external calls. Either way, the prompt box only edits clips already placed on the timeline - it doesn't pick clips from the bucket for you.

**Captions**: when `GEMINI_API_KEY` is set, every clip is automatically transcribed (Gemini, from the clip's own audio) into speech-synced captions the moment it's added to the timeline - no manual timing needed. Typing an explicit caption instruction in the prompt box (or the per-clip editor) overrides that clip back to a single static caption for its whole on-screen duration, same as before. Without a Gemini key, clips just have no captions until one is set manually.

Rendering has two interchangeable targets, switched with one env var (`RENDER_TARGET`) - no code change needed to go from one to the other:

- **`local`** (the default if unset) - renders on whichever machine is running the app, using the same headless-Chrome pipeline as `npx remotion render`, and saves to the local `out/` folder. This is what you get out of the box, with no AWS Lambda setup required - useful for trying the whole flow end-to-end before deploying.
- **`lambda`** - renders on AWS Lambda and uploads the result straight to S3, with a presigned download link shown in the app. This is the production path - set `RENDER_TARGET=lambda` in your hosting platform's environment config once Lambda is deployed (see "Deploying to AWS" below). Nothing else changes; the editor UI and API contract are identical either way.

- `src/` - the Remotion composition (`ClipsMontage`), still usable standalone via `npm run studio`.
- `lib/` - shared Zod schema/duration math (`remotion-schema.ts`), AWS/auth helpers, and the Gemini prompt interpreter (`ai/interpret-prompt.ts`), used by both `src/` and `app/`.
- `app/` - the Next.js App Router frontend: S3 clip browser, guided editor, live preview, render/progress/download and prompt-interpretation API routes.
- `scripts/` - a separate, untouched offline whisper/cutlist pipeline used to prep the original source clips. Not part of the running app.

## Local development

```console
npm install
```

**Editor app** (frontend + API routes):

```console
npm run dev
```

Nothing here requires AWS to try out. With `RENDER_TARGET` unset (or `local`), clicking "Generate video" renders on your machine and writes the file to `out/`. And if `SOURCE_CLIPS_BUCKET`/`SOURCE_CLIPS_REGION` aren't set, "Upload clips" and "Clips in the bucket" automatically fall back to saving/listing files under `public/uploads/` on local disk instead of erroring - so you can upload real clips, edit, and render the whole flow with zero AWS setup. The moment you fill in the S3 env vars (`.env.local` for local dev, or your hosting platform's env config), those same two sections switch to your real bucket automatically - no code change, just paste the bucket name/region/credentials in.

**Remotion Studio** (isolated composition authoring/regression checks, uses local files under `public/` and no AWS calls):

```console
npm run studio
```

**Lint / typecheck**:

```console
npm run lint
```

## Environment variables

Copy `.env.example` to `.env.local` for local dev, or set these in your hosting platform's environment config for deployment. Never commit real values or paste secrets into chat.

| Variable | Purpose |
| --- | --- |
| `EDITOR_APP_USERNAME` / `EDITOR_APP_PASSWORD` | Shared-password gate (`proxy.ts`) for the whole app. v1 shortcut for a single internal editor - not a multi-user auth system. |
| `RENDER_TARGET` | `local` (default if unset) renders on this server to `out/`; `lambda` renders on AWS Lambda to S3. Set at hosting/deploy time - see "Rendering" above. |
| `SOURCE_CLIPS_BUCKET` / `SOURCE_CLIPS_REGION` / `SOURCE_CLIPS_PREFIX` (optional) | Where AI-generated clips land, and where the app uploads new clips to. Reads and writes both go through short-lived presigned URLs - the bucket stays private throughout. Unset = automatic local-disk fallback under `public/uploads/` (see "Local development" above) - genuinely optional until you're ready to point at a real bucket. |
| `REMOTION_AWS_ACCESS_KEY_ID` / `REMOTION_AWS_SECRET_ACCESS_KEY` | Credentials for the IAM user created during Remotion Lambda setup below, reused for S3 browsing/uploading too. |
| `REMOTION_REGION` / `REMOTION_FUNCTION_NAME` / `REMOTION_SERVE_URL` | Identify the deployed Remotion Lambda function and bundled site. Only needed once `RENDER_TARGET=lambda`. |
| `GEMINI_API_KEY` | Enables free-form natural-language prompt understanding (Gemini) in the editor's prompt box. Get a key from [Google AI Studio](https://aistudio.google.com/apikey). Unset = prompt box falls back to the fixed deterministic phrasings in `app/editor/parseCommand.ts` - genuinely optional, same pattern as the other integrations here. |

## Deploying to AWS (for whoever sets up the AWS account)

This app was built and refactored in this environment, but never deployed here - no AWS credentials were available. Everything below needs to be run by someone with access to the target AWS account.

### 1. Remotion Lambda (rendering)

Full reference: https://www.remotion.dev/docs/lambda/setup

1. `npx remotion add @remotion/lambda` (already reflected in `package.json`, but confirms the CLI subcommands are available).
2. `npx remotion lambda policies role` → create the generated policy as `remotion-lambda-policy` and a Lambda-trusted IAM role `remotion-lambda-role` with it attached, in the AWS console.
3. Create an IAM user (e.g. `remotion-user`), generate an access key. Put it into your hosting platform's env config as `REMOTION_AWS_ACCESS_KEY_ID` / `REMOTION_AWS_SECRET_ACCESS_KEY` - never in `.env` files committed to git or pasted into chat.
4. `npx remotion lambda policies user` → attach the generated inline policy to that IAM user.
5. **App-specific addition, not part of Remotion's generated policy:** extend that same user's policy with `s3:ListBucket` on your source-clips bucket ARN and `s3:GetObject` + `s3:PutObject` on `<bucket>/*`. `PutObject` is what lets the in-app upload/drag-and-drop feature write new clips to the bucket using the same credential pair.
6. `npx remotion lambda policies validate` to sanity-check permissions.
7. `npx remotion lambda functions deploy` → note the printed function name as `REMOTION_FUNCTION_NAME`.
8. `npx remotion lambda sites create src/index.ts --site-name=<a-stable-name>` → note the printed serve URL as `REMOTION_SERVE_URL`. **Re-run this any time `src/` changes** (composition, schema, captions) - the site is a static bundle, it doesn't auto-update.
9. `npx remotion lambda quotas` - request a Lambda concurrency increase if this is a new AWS account and quotas are low.
10. Before wiring up the UI, sanity-check the whole pipeline with a manual render:
    ```console
    npx remotion lambda render <serve-url> ClipsMontage --props='{"clips":[{"id":"test","src":"https://...","trimBeforeSeconds":0,"trimAfterSeconds":5}]}'
    ```
11. **After every `remotion upgrade`**, redeploy the Lambda function (functions are bound to a specific Remotion version).
12. Once the above is verified, set `RENDER_TARGET=lambda` in the hosting platform's env config (step 2 below). This is the switch that moves rendering from local `out/` output to Lambda + S3 - no code or redeploy of the app itself required, just the env var.

### 2. Hosting the Next.js app

Recommended: **AWS Amplify Hosting** - it supports Next.js SSR/API routes directly, and keeps everything inside your AWS account with the least ops overhead for what is effectively a single-user internal tool. Point it at this repo/branch, set the environment variables above (including `GEMINI_API_KEY`, if you want the prompt box to understand free text in production rather than just the fixed phrasings) in the Amplify console, and it builds with `npm run build` (already aliased to `next build`).

If Amplify's supported Next.js version ever lags behind what's needed here, fall back to **AWS App Runner** from a Dockerfile using `next build`'s standalone output (already enabled via `output: "standalone"` in `next.config.ts`) - still no VPC/load balancer to hand-manage.

ECS/Fargate/EKS are not recommended here - meaningfully more infrastructure (VPC, load balancer, task definitions) than this scale of app justifies.

### 3. Ongoing maintenance

- Redeploy the Lambda function after any `remotion`/`@remotion/*` version upgrade.
- Redeploy the site (`remotion lambda sites create`) after any change under `src/`.
- Rotate `EDITOR_APP_PASSWORD` by changing the env var only - no redeploy of code required.
- Rendered output currently lands in Remotion Lambda's own auto-managed S3 bucket (`privacy: "private"`, presigned download link shown in the app). Writing into your own pre-existing bucket instead is possible (`outName` in `lib/aws/lambda-render.ts`) but requires it to be in the same AWS region as the Lambda function and an extended IAM policy - not set up by default.
- No lifecycle rule is set on render output - consider adding an S3 lifecycle policy to expire old renders if storage cost becomes a concern.
- `RENDER_TARGET=local` is for testing on a machine you have direct file access to (your laptop, a dev box) - it is **not** viable once hosted on Amplify/App Runner/anything serverless-ish, since `out/` lives on ephemeral, per-instance storage that disappears on redeploy or scale-to-zero and generally isn't reachable from outside the container anyway. Always set `RENDER_TARGET=lambda` for the hosted deployment.
- Same goes for the local-disk clip storage fallback (`public/uploads/`, used automatically while `SOURCE_CLIPS_BUCKET` is unset) - it's a local-testing convenience, not viable once hosted for the same ephemeral-storage reason. Set `SOURCE_CLIPS_BUCKET`/`SOURCE_CLIPS_REGION` before going live.

## What's intentionally out of scope (v1)

Multi-user accounts, thumbnail-generation pipeline (native `<video>` scrubbing is used instead), drag-and-drop *timeline* reordering (drag-and-drop is used for upload only; the timeline itself uses up/down move buttons), undo/redo, real S3 object renaming (display-name override only), non-vertical/non-24fps output, and rate limiting/cost controls beyond the shared-password gate. Clip count is uncapped in the UI - a very large number of clips will eventually hit Remotion Lambda's own render timeout/memory limits, which aren't tuned for in this pass. Caption transcription has no caching - re-adding the same clip re-transcribes it, and there's no retry button in the UI if it silently comes back empty (network hiccup, no speech detected, etc.) short of removing and re-adding the clip. The old `scripts/*.mjs` whisper pipeline is unrelated and untouched - it's a separate, offline tool used to prep the original 7-clip source video, not part of the running app.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
