# Unit Testing

This project uses Vitest for the Node.js API and React/Vite web workspace.
HarmonyOS local tests are kept under `entry/src/test` and device tests under
`entry/src/ohosTest`.

## Test Locations

- API unit and route tests: `apps/api/src/**/*.test.ts`
- Web API wrapper tests: `apps/web/src/**/*.test.ts`
- HarmonyOS local tests: `entry/src/test/*.test.ets`
- HarmonyOS device tests: `entry/src/ohosTest/ets/test/*.test.ets`

## Run Tests

```powershell
npm.cmd test
```

Run a single workspace:

```powershell
npm.cmd run test -w @moyan/api
npm.cmd run test -w @moyan/web
```

## Coverage

```powershell
npm.cmd run coverage
```

Coverage reports are generated in each workspace's `coverage` directory:

- `apps/api/coverage`
- `apps/web/coverage`

The current tests focus on core behavior:

- Device command mapping, success records, failure logs, and log retention
- API route envelopes, validation errors, command lookup, and log limits
- Assistant confirmation flow and pending action behavior
- IoTDA shadow normalization for field aliases and numeric conversion
- Web request handling, backend error details, and URL encoding
