# Khan Runner · 2.1.4

[**Download the newest Chrome extension ZIP**](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Chrome-v2.1.4.zip)

The owner confirmed that 2.1.3 watched the videos. This update fixes a reproduced exercise-reader defect: nested response panels could hide the question stem and sibling Check/feedback controls. It also handles printed answer labels, waits for delayed question content, distinguishes instruction text from assignment headings, and reports specific exercise pause diagnostics.

## Install or replace 2.1.3

1. Stop/remove the old Khan Runner in `chrome://extensions`.
2. Download and **extract** the new ZIP into a permanent folder.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted **extension** folder containing `manifest.json`.
4. Confirm **2.1.4**, refresh your Khan tabs, and press **Start both tabs** on All assignments / To-do.

Keep the extracted folder. Chrome loads that folder, not the ZIP file.

## Verification and limits

The final release passed 286 Node checks and 12 actual-browser test programs. A new exercise flow completed eight mixed-format questions through actual upstream MathQuill, with eight once-only Checks, correct fixture feedback, seven Next actions and Done. Coverage also includes both work tabs, real videos at 2×, controlled native input, delayed loading, pagination, Stop and worker/reload recovery.

Browser fixtures use real Chrome APIs, media and editors with synthetic classroom responses. Actual Khan exercise acceptance remains unverified; the cloud workspace is not connected to the owner's signed-in Chrome. The exact owner-side pause code is still needed if the updated exercise lane stops. Copy diagnostics from that tab; its new probe omits question text, answers, class URLs and student details.

Supported formats include restricted polynomial factoring/expansion/simplification, single-variable linear equations, single rational polynomial fractions, numeric fractions and standard exact trig values. Graphs, multiple choice/fields, systems, general word problems and unsupported notation pause. Existing answers and uncertain submissions are protected. There is no paid API, helper server, credential access, private app state or grade API.

- [Complete corrected source](source/)
- [Complete source and evidence ZIP](https://github.com/PandaExpress15/KUBBA-KHAN/raw/refs/heads/main/downloads/Khan-Runner-Source-v2.1.4.zip)
- [Verification report](docs/VERIFICATION.md)
- [Root cause and fixes](docs/ROOT_CAUSE.md)
- [Download checksums](downloads/SHA256SUMS.txt)

Project Sovereign and RADAR remain untouched. Older versioned ZIPs are retained as release history.
