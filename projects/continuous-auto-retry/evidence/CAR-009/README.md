# CAR-009 evidence — durable forced continuation after interruption exhaustion

- Root cause: v2.9.43 called `sendContinuation()` only once after 3/3; a visible Stop caused an immediate false return, so the log said it would append but no Send click happened.
- PR #42 final head: `f16d1ddd99b17cae0d230d1d015e2db0931c8ff5`.
- Exact-head Test run `35428733800`: SUCCESS with standard `node --test`; diagnostic failing run `35428669736` exposed a test fixture issue and was superseded.
- Regression proof includes: 3/3 + visible Stop -> Stop click, pending intent retained, banner removed, composer/send restored, forced send succeeds inside the normal 60-second cooldown, pending clears only after actual Send click.
- Squash merge/release target: `b35124fe1a8f3279f412c67164f5daaeb142c575`.
- Main Test run `35428760765`: SUCCESS.
- Userscript Release `v2.9.44`: `chatgpt-auto-confirm.user.js`, 260967 bytes, `sha256:71d8c1e12fe5eed91ae717c5ce6d1e25a96c76115972b9292207b20475c59809`.
- Canonical source blob: `b608025f11e8007ee965013d314222ce30fb5522`.
- Paired host PR #9 exact-head `3539dc41e2d84de461bf0b2dc85594a12b97700f`, main/release source `c412db85e4809859ca326b924d74a93bcc5ff7ab`.
- Host PR CI `35428950281`, main CI `35428973694`, tag/package/Release workflow `35428994707`: SUCCESS.
- Host Release `v0.6.18`: `fabushi-chrome-0.6.18.zip`, 135746 bytes, `sha256:935db4b71f1a57e87eb67872447fbbe8d7b0d6b48d3cb51d4efa4495be34ee43`.
- Host bundled userscript content SHA: `b608025f11e8007ee965013d314222ce30fb5522`.
