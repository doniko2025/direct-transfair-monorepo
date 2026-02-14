// apps/direct-transfair-mobile/api.ts
// ------------------------------------------------------------
// Compat layer (CommonJS) to avoid TS errors with
// "verbatimModuleSyntax" when this file is treated as CommonJS.
//
// This file re-exports an AxiosInstance "api" (like the old file)
// and exposes "setAuthToken".
// Internally it reuses the real implementation from ./services/api
// so you keep ONE source of truth.
// ------------------------------------------------------------

declare const require: (id: string) => any;
declare const module: { exports: any };

type AxiosInstance = import("axios").AxiosInstance;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const services = require("./services/api") as typeof import("./services/api");

// `services.api` is your API class instance (from services/api.ts)
// `services.api.http` is the Axios instance actually used for requests.
const api: AxiosInstance = services.api.http;

function setAuthToken(token: string | null): void {
  services.api.setToken(token);
}

// CommonJS exports (no "export" keyword => fixes verbatimModuleSyntax errors)
module.exports = { api, setAuthToken };
