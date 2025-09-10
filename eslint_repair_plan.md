# ESLint Repair Plan

Generated: 2025-09-09T03:28:28.871Z

Top-10 files to address:

- **/Users/andycyw/NoobNinja/source/kmodel.js** — problems: 50, fixable: 50
  - top rules: space-in-parens(50)
  - recommendation: auto-try --fix for fixable issues, then manual review
- **/Users/andycyw/NoobNinja/source/index.js** — problems: 45, fixable: 25
  - top rules: no-var(18), vars-on-top(15), prefer-template(4), prefer-arrow-callback(4), prefer-destructuring(1)
  - recommendation: auto-try --fix for fixable issues, then manual review
- **/Users/andycyw/NoobNinja/source/python.js** — problems: 30, fixable: 2
  - top rules: no-multi-assign(16), consistent-this(5), no-constructor-return(3), no-misleading-character-class(2), no-undef-init(2)
  - recommendation: auto-try --fix for fixable issues, then manual review
  - notes: Contains rules that typically require manual inspection: no-constructor-return
- **/Users/andycyw/NoobNinja/source/view.js** — problems: 24, fixable: 0
  - top rules: no-control-regex(16), no-await-in-loop(7), no-unused-expressions(1)
  - recommendation: manual review required
  - notes: Contains rules that typically require manual inspection: no-control-regex, no-await-in-loop
- **/Users/andycyw/NoobNinja/source/pytorch.js** — problems: 14, fixable: 0
  - top rules: no-await-in-loop(7), prefer-destructuring(6), consistent-this(1)
  - recommendation: manual review required
  - notes: Contains rules that typically require manual inspection: no-await-in-loop
- **/Users/andycyw/NoobNinja/source/base.js** — problems: 13, fixable: 0
  - top rules: no-extend-native(13)
  - recommendation: manual review required
  - notes: Contains rules that typically require manual inspection: no-extend-native
- **/Users/andycyw/NoobNinja/source/acuity.js** — problems: 7, fixable: 0
  - top rules: no-unused-vars(5), prefer-destructuring(2)
  - recommendation: manual review required
- **/Users/andycyw/NoobNinja/source/keras.js** — problems: 4, fixable: 0
  - top rules: no-await-in-loop(2), no-use-before-define(1), prefer-destructuring(1)
  - recommendation: manual review required
  - notes: Contains rules that typically require manual inspection: no-await-in-loop
- **/Users/andycyw/NoobNinja/source/onnx.js** — problems: 4, fixable: 0
  - top rules: no-use-before-define(3), no-await-in-loop(1)
  - recommendation: manual review required
  - notes: Contains rules that typically require manual inspection: no-await-in-loop
- **/Users/andycyw/NoobNinja/source/executorch.js** — problems: 3, fixable: 0
  - top rules: no-await-in-loop(3)
  - recommendation: manual review required
  - notes: Contains rules that typically require manual inspection: no-await-in-loop

Suggested next action: run `npx eslint <file> --fix` for files with fixable issues, commit in small batches, then manually inspect rules flagged above.
