# @ontology-search/typescript-config

Shared TypeScript base configs extended by every package's `tsconfig.json`:

| File         | For                               |
| ------------ | --------------------------------- |
| `node.json`  | Node libraries and the API server |
| `react.json` | The Vite + React web app          |

All bases enable strict mode, `noUncheckedIndexedAccess`, target ES2022, and
module NodeNext.
