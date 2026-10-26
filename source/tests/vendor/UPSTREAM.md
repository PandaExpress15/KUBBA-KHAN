# Real editor fixtures, not simulated interfaces

MathQuill 0.10.1 was built from the upstream tag https://github.com/mathquill/mathquill/tree/v0.10.1, commit `442079571c8574495eb9a636bc7af3b20a8c034f`. The readable `mathquill/mathquill.js` uses upstream's `make js` concatenation/ASCII escaping, with PJS 3.1.0. CSS uses upstream LESS with `omit-font-face=true` and `basic=false`; no Symbola font is redistributed. MathQuill's MPL-2.0 notice and full license are retained. Upstream source is linked above and was not patched.

Build tools: `npm install --ignore-scripts pjs@3.1.0 less@4.2.0`, with the resulting complete lockfile preserved as `build-package-lock.json`. Automatic install scripts were disabled. The PJS source is directly concatenated by the upstream build; its install script was not needed. Build commands, from the upstream checkout:

```
make js PJS_SRC=/path/to/pjs/src/p.js NODE_MODULES_INSTALLED=/path/to/build-package-lock.json
lessc --modify-var=omit-font-face=true --modify-var=basic=false src/css/main.less build/mathquill.css
```

PJS is MIT-licensed; `pjs-LICENSE.txt` is from https://github.com/jayferd/pjs/blob/master/LICENSE. MathQuill's license text is the standard MPL-2.0 text from the system common-license collection.

jQuery 3.7.1 is the full unminified official npm distribution (MIT). MathQuill's scrolling uses `.stop()`, so the Slim distribution is insufficient. The registry tarball SHA-512 is `m4avr8yL8kmFN8psrbFFFmB/If14iN5o9nw/NgnnM+kybDJpRsAynV2BsfpTYrTRysYUdADVD7CkUUizgkpLfg==` and was independently matched before extraction. `jquery-LICENSE.txt` is included. These files are served solely to synthetic editor test pages.

An initial npm MathQuill distribution was inspected but was a fork. It is not the final bundled test JS; final tests use the upstream tag built as described above. All dependencies were downloaded over verified TLS; no package lifecycle scripts, paid services or remote runtime scripts are required.

`../fixtures/playback.webm` is generated local test media: `ffmpeg -f lavfi -i testsrc=size=320x180:rate=24 -t 16 -an -c:v libvpx -pix_fmt yuv420p -threads 2 playback.webm`. Tests observe actual browser time advancement and trusted ended events. No player seeking or synthetic completion is used.
