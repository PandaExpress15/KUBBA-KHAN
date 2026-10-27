# Khan Runner · 2.1.5

[**Download the newest Chrome extension ZIP**](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Chrome-v2.1.5.zip)

Each supported question now waits a fresh random **whole number of seconds from 10 through 30** before its answer is entered. The popup shows a countdown. The saved deadline survives a worker restart, Stop cancels pending actions, and the video lane continues independently. Existing answers, verified readback and once-only Check remain protected.

## Install or replace 2.1.4

1. Stop/remove the old Khan Runner in `chrome://extensions`.
2. Download and **extract** the new ZIP into a permanent folder.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted **extension** folder containing `manifest.json`.
4. Confirm **2.1.5**, refresh your Khan tabs, and press **Start both tabs** on All assignments / To-do. Filter the list to exercises if you only want the math queue.

Keep the extracted folder. Chrome loads that folder, not the ZIP file.

## Verification and limits

See the current verification report for exact executed commands, elapsed-time observations and source hashes. Browser checks use real Chrome APIs, media and editors with synthetic classroom responses. Historical 2.1.4 evidence remains under source/evidence/v2.1.4; its test counts are not current-release runs.

The owner confirmed that 2.1.3 watched videos. Actual Khan exercise acceptance remains unverified; this workspace is not connected to the owner's signed-in Chrome. Browser scheduling or device sleep can make a countdown wakeup late.

The existing restricted polynomial, linear-equation, rational-fraction and exact-trig solver is retained. Unsupported formats pause. No paid API, helper server, credential access, private app state or grade API is used.

- [Complete corrected source](source/)
- [Complete source and evidence ZIP](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Source-v2.1.5.zip)
- [Verification report](docs/VERIFICATION.md)
- [Implementation and prior root cause](docs/ROOT_CAUSE.md)
- [Download checksums](downloads/SHA256SUMS.txt)

Project Sovereign and RADAR remain untouched. Older versioned ZIPs are retained as release history.
