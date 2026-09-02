# `@deepseek-ai/dsh-gstar-data-source-reference`

English | [中文](README.zh.md)

Declarative plugin for one authoritative GSTAR reference source. Each Cordis row supplies a stable id, public name, publisher, HTTP(S) entry point, covered AOI categories, and default station enablement. The plugin registers verification capability and deliberately contributes no synchronization operation.

The GSTAR Profile instantiates this package separately for the National Public Data Resource Registration Platform, National Government Service Platform, National Enterprise Credit Information Publicity System, National Financial Regulatory Administration license query, Ministry of Education institution list, and National Health Commission data query. Each instance has an independent dynamic lifetime and station switch even though the package implementation is shared.

## Model Experience

None, as reference metadata remains a Host and browser product projection.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Enabling a reference admits it for verification policy but does not scrape or ingest the platform.
- Authentication, anti-bot flows, and source-specific field matching require dedicated source plugins rather than generic configuration.
- The configured URL is syntax-checked for HTTP(S); publisher authority and content freshness remain deployment review responsibilities.
