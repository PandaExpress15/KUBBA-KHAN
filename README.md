# KUBBA-KHAN · Khan Runner 2.1.2

[**Download the Chrome extension ZIP (50 KB)**](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Chrome-v2.1.2.zip)

This is the newest corrected build verified in real Chrome with isolated classroom fixtures. The owner’s signed-in Khan classroom remains unverified. The extension automatically plays queued videos and enters/checks supported exercise answers; unsupported or uncertain items pause.

## Install in Chrome

1. Download the ZIP above and extract it into a permanent folder.
2. Open `chrome://extensions`, stop/remove the older Khan Runner, and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted **extension** folder containing `manifest.json`.
4. Confirm version **2.1.2**, refresh the classroom page, open All assignments / To-do, and click **Start both tabs**.
5. Use **Stop all** to cancel future automatic actions. If anything pauses or fails, use **Copy diagnostics**.

Chrome loads the extracted folder, so keep it. The ZIP itself is not uploaded to the Chrome Web Store and cannot be installed with Load unpacked until it is extracted.

## Source and evidence

- [Complete corrected source and test evidence ZIP](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Source-v2.1.2.zip)
- [Actual verification results](docs/VERIFICATION.md)
- [Reproduced defects and remaining live boundary](docs/ROOT_CAUSE.md)
- [ZIP SHA-256 checksums](downloads/SHA256SUMS.txt)

Verified: 278 Node checks; actual Chrome extension installation and source bytes; two real media ends at effective 2×; two fixture exercise assignments with four once-only Checks, Next/Done; actual MathQuill, Stop, worker restart and extension reload. Synthetic pages are not proof of current Khan markup, recorded course credit, or live acceptance.

No paid APIs, runtime server, cookies, authentication transfer, grade API, or forged completion. Project Sovereign and RADAR are untouched.
