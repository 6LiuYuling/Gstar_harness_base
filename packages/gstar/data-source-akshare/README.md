# `@deepseek-ai/dsh-gstar-data-source-akshare`

English | [中文](README.zh.md)

Dynamically loadable AKShare listed-company enrichment source for GSTAR. It registers `akshare-a-share` as a disabled-by-default direct entity source for enterprise and financial AOIs. Enabling it affects one station; an explicit synchronization runs the bundled Python bridge through `ctx.subprocess` and commits one complete spatial patch after validation.

The bridge uses AKShare's exchange-aggregated A-share code/name list to match existing AOI names and aliases. It retries transient request failures and switches to AKShare's complete Eastmoney A-share list when the exchange aggregate remains unavailable, then requests the matched company's CNInfo profile with the same retry policy. A profile is accepted only when its registered or office address contains every available city and district token from the station title. The source enriches the existing AOI with a `listed_company` entity and records the AKShare/CNInfo source, retrieval time, and checksum. It does not create geometry, merge a group parent with a listed subsidiary, or copy a company into a neighboring district.

Install AKShare into the Python environment selected by `pythonExecutable`, for example with `python -m pip install --upgrade akshare`. `requestMaxRetries` and `requestRetryDelayMilliseconds` bound retries for each stock-list or company-profile request. `maxProfiles`, `timeoutMilliseconds`, and `maxOutputBytes` bound remote profile calls, child lifetime, and collected output. The plugin reports concise installation, transport, and TLS diagnostics and never commits partial bridge output.

TLS certificate and hostname verification is strict by default. Set `caBundlePath` to a PEM bundle containing the enterprise proxy CA; the bridge passes it to Requests as `REQUESTS_CA_BUNDLE`. An empty value preserves an inherited `REQUESTS_CA_BUNDLE`. `insecureSkipTlsVerify` disables Requests verification only inside the bridge child and cannot be combined with `caBundlePath`; use it only for temporary diagnosis on a trusted network because it accepts forged, expired, or mismatched certificates.

## Model Experience

None, as the source enriches Host product data and registers no prompt, tool, or Session event.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Name matching starts from AOIs already acquired for the station; a listed company absent from the AOI publication is not invented as geometry.
- Corporate names and addresses can change, and AKShare exposes upstream data rather than becoming its authority; provenance and sample verification remain required.
- One synchronization calls profile endpoints sequentially up to `maxProfiles`; large stations need a cached or scheduled connector before increasing this bound.
- Windows system trust is not imported into Requests automatically; private enterprise CAs require an inherited bundle or `caBundlePath`.
- AKShare code uses the MIT license, while exchange and CNInfo data remain subject to their publishers' terms.
