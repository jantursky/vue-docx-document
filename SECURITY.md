# Security policy

## Supported versions

Only the latest release of `vue-docx-document` gets fixes.

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's [private vulnerability reporting](https://github.com/jantursky/vue-docx-document/security/advisories/new), or email jan.tursky@gmail.com with a description and, if you can, a minimal reproduction.

You'll get an answer within a week. Once a fix is released, the advisory is published with credit, unless you'd rather stay anonymous.

Issues in the `docx` package itself should also go to [docx](https://github.com/dolanmiu/docx/security).

## Things to know

- Image `src` URLs are fetched with `fetch`. Only `http` and `https` are allowed, and a response is capped at 20 MB. Other schemes are rejected. If the URLs come from users, check the host before you pass them in, since the library will request whatever it is given.
- Link `href` values are checked against an allow-list: `http`, `https`, `mailto` and `tel`. Any other link renders as plain text and a warning is logged.
- Text is escaped by the `docx` package when it writes the XML, so user input ends up in the document as text. It isn't parsed as markup or executed.
- The library doesn't read or parse existing .docx files. It only writes new ones, so a crafted input file can't reach its parser.
