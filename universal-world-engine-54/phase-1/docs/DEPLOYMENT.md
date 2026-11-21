# UWE54 Phase 1 Deployment
## Local run + GitHub Pages instructions
### 2026-11-08

## Status

Local only. No deploy has been performed. A GitHub Pages deploy needs NEURO's separate explicit approval (gate G9). Nothing in this document deploys anything.

## Run locally

Requirements: Node.js 18+ (tested on Node v24.22.1). No npm install, no network, no build tools beyond Node.

```sh
cd ~/workspace/builds/universal-world-engine-54/phase-1
node tests/run-all.mjs        # Node harness: 5/5 test files PASS
node tests/cdp-probe.mjs      # Browser probe (needs Xvfb + /opt/meta-chromium/chrome)
```

Open the demo in a browser (file:// works, zero network calls):

```
profiles/city/demo.html
profiles/city/demo.html?autotest=1     # 8 in-page self-checks
profiles/city/demo.html?freezeTick=30  # pause the sim at tick 30 (or up to 5 steps after)
```

Rebuild the demo (deterministic; rebuilding produces the identical SHA):

```sh
node profiles/city/build-demo.mjs
sha256sum profiles/city/demo.html
# 0b38ba74251e5df192502b115c9e8b3c899db353242e448645117199862a7c86
```

## GitHub Pages deploy (instructions only, NOT performed)

Target (PROPOSED, per the plan): GitHub Pages. No third-party platforms.

1. Get NEURO's explicit approval for the deploy (repo, branch, and path). No approval exists yet.
2. Publish the contents of phase-1/profiles/city/demo.html as a single static file (plus nothing else; the demo is self-contained). A Pages deploy serves one HTML file; no server, no build step, no credentials.
3. Verify after deploy: the live page loads with zero console errors, shows 11 towers, the HUD shows live values, and the page carries the DEMO / PRE-LAUNCH / SIMULATED / DEVELOPMENT MODE labels. Record the live URL, the deployed file SHA, and the verification result.
4. Do NOT deploy the harness, the reference evidence, or any file containing keys or credentials. This repo contains none, but verify before publishing.

## What must never be deployed from this phase

- Anything labeled DEVELOPMENT MODE presented as final art.
- The demo presented as a live or production system. It is a pre-launch demo of a simulated city.
- Any receipt, chain, or summary presented as a production audit record. The chains are deterministic sim evidence, not production receipts.
