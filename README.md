# Khan Runner · 2.1.3

[**Download the newest Chrome extension ZIP**](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Chrome-Latest.zip)

[Version 2.1.3 direct download](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Chrome-v2.1.3.zip)

## What this fixes

The owner reported Start failed while the assignment list's Next button was visible. A real Chrome regression reproduced the old matcher's rejection of a visible Next button named Next page. Version 2.1.3 recognizes visible and accessible pagination names, waits for loading controls, checks same-class targets, and preserves navigation intent when document changes interrupt Chrome's reply.

The popup now says **Scanning your assignment list**: it is collecting Video and Exercise assignments across the pages. Articles are skipped. It does not require a Reading assignment.

## Install or replace 2.1.2

1. Download and **extract** the ZIP into a permanent folder.
2. Open `chrome://extensions`, stop/remove the old Khan Runner, and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted **extension** folder containing `manifest.json`.
4. Confirm **2.1.3**, refresh the classroom page, and press **Start both tabs** on All assignments / To-do.
5. Use **Stop all** to cancel future automatic actions. Copy diagnostics if a boundary pauses.

Keep the extracted folder. Chrome loads that folder, not the ZIP file.

## Verified capabilities and limits

All 283 Node checks and 11 actual-browser programs passed on the released source. Coverage includes 23 pagination-control cases, scanning five pages, resetting from page five, delayed controls, real document navigation, two actual work tabs, two real videos at 2×, two exercise assignments with four once-only Checks, Next/Done, actual MathQuill, Stop and worker/reload recovery.

Browser fixtures use real Chrome APIs/media/editors with synthetic classroom responses. Your signed-in Khan player/editor and course credit remain unverified. The solver supports restricted validated algebra, linear equations, single rational fractions and standard exact trig values; unsupported questions pause. Existing answers and uncertain submissions are protected. No paid API, helper server, authentication transfer, private app state or grade API is used.

- [Complete corrected source](source/)
- [Complete source and evidence ZIP](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Source-v2.1.3.zip)
- [Verification report](docs/VERIFICATION.md)
- [Root cause and fixes](docs/ROOT_CAUSE.md)
- [Download checksums](downloads/SHA256SUMS.txt)

Project Sovereign and RADAR remain untouched. Older ZIPs are retained as release history.
