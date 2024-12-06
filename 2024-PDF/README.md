# 2024 Edition publication process

This year's PDF version was manually created by generating an html file from bikeshed and then
manually modifying the markup to be able to re-use the stylesheets from ecmarkup used to generate
various other Ecma programming-related standards. This directory contains:
- ecma-print-styles.css, primarily a subset of ecmarkup css with some additional bespoke style rules to create better "issue" and "example" elements
- fonts/, specifically to support the zero-with-dot character option
- img/, cover background images and header image
- index.html, the final markup used for the PDF
- print.js, a pared-down version of the script used by PrinceXML to generate larger Ecma standards publications

The command used to generate PDF was the following, run from this directory:

```bash
prince-books --tagged-pdf --script ./print.js ./index.html -o ECMA-XXX-source-map.pdf
```