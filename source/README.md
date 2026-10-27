# KUBLA KHAN · 2.1.7

[Download KUBLA KHAN for Chrome](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Chrome-v2.1.7.zip)

This release fixes stopping after the first answer when the detached question footer switches from Check to Next or Continue. A real Chrome regression reproduced2.1.6 losing the footer's Correct feedback. The corrected flow completed THREE consecutive questions, including a repeated expression, with3 once-only Checks,2 Next/Continue actions and1 Done. See TEST_REPORT.md for exact checks and live-site limits.

Stop/remove the old extension, extract the ZIP into a permanent folder, and use chrome://extensions → Developer mode → Load unpacked → extension. Confirm KUBLA KHAN2.1.7 and refresh Khan. Start from All assignments / To-do. One exercise runs at a time alongside the independent video lane. Random10–30-second pacing, Stop, verified readback and existing-work protection remain.

The local restricted math solver is unchanged. Unsupported/image-only formats pause. The current release passed296 Node checks and3 targeted actual-Chrome programs on synthetic classroom pages. The owner's signed-in Chrome is not attached, so live Khan exercise acceptance and course credit remain unverified. No helper service, paid API, private app state or expanded permission is added. Project Sovereign and RADAR are untouched.
