/** Trusted Python program embedded in the published JavaScript bundle. */
export const AKSHARE_BRIDGE = String.raw`"""Resolve station enterprise AOIs against AKShare A-share company profiles."""

from __future__ import annotations

import contextlib
import csv
import json
import re
import sys
import time
from pathlib import Path
from typing import Any


PROFILE_COLUMNS = {
    "公司名称": "company_name",
    "A股代码": "stock_code",
    "A股简称": "stock_name",
    "所属市场": "market",
    "所属行业": "industry",
    "法人代表": "legal_representative",
    "注册资金": "registered_capital",
    "成立日期": "founded_at",
    "上市日期": "listed_at",
    "官方网站": "website",
    "电子邮箱": "email",
    "联系电话": "phone",
    "注册地址": "registered_address",
    "办公地址": "office_address",
    "主营业务": "main_business",
    "经营范围": "business_scope",
}

CACHE_PROFILE_COLUMNS = {
    "company_name": ("name", "company_name", "公司名称", "公司全称"),
    "stock_code": ("code", "numeric_code", "stock_code", "A股代码", "股票代码"),
    "stock_name": ("short_name", "stock_name", "A股简称"),
    "market": ("market", "所属市场", "上市市场"),
    "industry": ("industry", "所属行业"),
    "legal_representative": ("legal_rep", "legal_representative", "法人代表", "法定代表人"),
    "registered_capital": ("capital", "registered_capital", "注册资金", "注册资本"),
    "founded_at": ("establish_date", "founded_at", "成立日期"),
    "listed_at": ("list_date", "listed_at", "上市日期"),
    "website": ("website", "官方网站", "公司网址"),
    "email": ("email", "电子邮箱"),
    "phone": ("phone", "联系电话"),
    "registered_address": ("reg_address", "registered_address", "注册地址"),
    "office_address": ("office_address", "办公地址"),
    "main_business": ("main_business", "主营业务"),
    "business_scope": ("business_scope", "经营范围"),
}


def normalized_name(value: object) -> str:
    """Normalize company display text for deterministic short-name matching."""
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]", "", str(value)).upper()


def station_tokens(value: str) -> list[str]:
    """Normalize canonical or display-style station names into address tokens."""
    title = re.sub(r"(?:局点|站点)$", "", value.strip())
    parts = [part for part in re.split(r"[·•/／>＞\\|—–_-]+", title) if part]
    tokens: list[tuple[str, str | None]] = []
    for part in parts:
        administrative = re.findall(r"([^省市区县]+)([省市区县])", part)
        if administrative:
            tokens.extend((name.strip(), suffix) for name, suffix in administrative if name.strip())
        elif part.strip():
            tokens.append((part.strip(), None))
    if any(suffix in {"市", "区", "县"} for _name, suffix in tokens):
        tokens = [(name, suffix) for name, suffix in tokens if suffix != "省"]
    normalized: list[str] = []
    for name, _suffix in tokens:
        token = re.sub(r"\s+", "", name)
        if token and token not in normalized:
            normalized.append(token)
    return normalized


def addresses_belong_to_station(registered: object, office: object, title: str) -> bool:
    """Require every available station token in either registered or office address."""
    addresses = re.sub(r"\s+", "", f"{registered or ''} {office or ''}")
    tokens = station_tokens(title)
    return bool(tokens) and all(token in addresses for token in tokens)


def belongs_to_station(profile: dict[str, object], title: str) -> bool:
    """Check a raw CNInfo profile against the station title."""
    return addresses_belong_to_station(
        profile.get("注册地址"),
        profile.get("办公地址"),
        title,
    )


def json_value(value: object) -> str | int | float | bool | None:
    """Convert pandas and date scalars into the GSTAR entity field vocabulary."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value != value:
            return None
        return value
    if hasattr(value, "isoformat"):
        return str(value.isoformat())
    text = str(value).strip()
    return text or None


def first_cached_value(profile: dict[str, object], names: tuple[str, ...]) -> object:
    """Read the first populated value across supported persistent-database columns."""
    for name in names:
        value = json_value(profile.get(name))
        if value is not None:
            return value
    return None


def normalized_aoi_names(aoi: dict[str, object]) -> list[str]:
    """Collect normalized AOI names and aliases used for company matching."""
    aliases = aoi.get("aliases")
    names = [aoi.get("name"), *(aliases if isinstance(aliases, list) else [])]
    return [
        item for value in names if isinstance(value, str)
        if (item := normalized_name(value))
    ]


def company_name_matches(values: list[object], normalized: list[str]) -> bool:
    """Match a full or short company name against one AOI name or alias."""
    candidates = [
        candidate for value in values if json_value(value) is not None
        if (candidate := normalized_name(value))
    ]
    return any(
        candidate in aoi_name or aoi_name in candidate
        for candidate in candidates
        for aoi_name in normalized
    )


def load_profile_database(
    path: str,
    aois: list[object],
    station_title: str,
    max_profiles: int,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Resolve AOIs from a persistent AKShare/CNInfo CSV without remote requests."""
    database = Path(path).expanduser()
    if not database.is_file():
        raise RuntimeError(f"AKShare 本地公司档案库不存在：{database}")
    try:
        with database.open("r", encoding="utf-8-sig", newline="") as stream:
            profiles = list(csv.DictReader(stream))
    except (OSError, csv.Error, UnicodeError) as error:
        raise RuntimeError(f"AKShare 本地公司档案库读取失败：{database}") from error

    records: list[dict[str, Any]] = []
    matched_codes: set[str] = set()
    candidate_aoi_count = 0
    name_matched_aoi_count = 0
    address_matched_aoi_count = 0
    for raw_aoi in aois:
        if not isinstance(raw_aoi, dict) or not isinstance(raw_aoi.get("id"), str):
            continue
        candidate_aoi_count += 1
        normalized = normalized_aoi_names(raw_aoi)
        name_matches = [
            profile for profile in profiles
            if company_name_matches([
                first_cached_value(profile, CACHE_PROFILE_COLUMNS["company_name"]),
                first_cached_value(profile, CACHE_PROFILE_COLUMNS["stock_name"]),
            ], normalized)
        ]
        if not name_matches:
            continue
        name_matched_aoi_count += 1
        matched_profile = next((
            profile for profile in name_matches
            if addresses_belong_to_station(
                first_cached_value(profile, CACHE_PROFILE_COLUMNS["registered_address"]),
                first_cached_value(profile, CACHE_PROFILE_COLUMNS["office_address"]),
                station_title,
            )
        ), None)
        if matched_profile is None:
            continue
        address_matched_aoi_count += 1
        fields = {
            target: json_value(first_cached_value(matched_profile, names))
            for target, names in CACHE_PROFILE_COLUMNS.items()
        }
        raw_code = fields.get("stock_code")
        code = re.sub(r"^(?:SH|SZ|BJ)", "", str(raw_code or "").strip(), flags=re.IGNORECASE)
        if not code or code in matched_codes:
            continue
        fields["stock_code"] = code
        matched_codes.add(code)
        records.append({"aoiId": raw_aoi["id"], "code": code, "fields": fields})
        if len(records) >= max_profiles:
            break
    return records, {
        "candidateAoiCount": candidate_aoi_count,
        "nameMatchedAoiCount": name_matched_aoi_count,
        "addressMatchedAoiCount": address_matched_aoi_count,
    }


def configure_tls(insecure_skip_tls_verify: bool) -> None:
    """Apply the explicit insecure policy only inside this isolated bridge process."""
    if not insecure_skip_tls_verify:
        return
    import requests

    verified_request = requests.sessions.Session.request

    def unverified_request(
        session: requests.Session, method: str, url: str, **kwargs: Any
    ) -> requests.Response:
        kwargs["verify"] = False
        return verified_request(session, method, url, **kwargs)

    requests.sessions.Session.request = unverified_request


class RemoteRequestError(RuntimeError):
    """Identify an exhausted upstream request without exposing a Python traceback."""


class CandidateSourcesUnavailable(RuntimeError):
    """Report that every complete A-share candidate source is unavailable."""


def request_with_retry(
    label: str,
    operation: Any,
    request_max_retries: int,
    request_retry_delay_milliseconds: int,
) -> Any:
    """Retry transient transport failures before reporting one concise upstream error."""
    import requests

    try:
        import aiohttp
    except ImportError:
        aiohttp_errors: tuple[type[BaseException], ...] = ()
    else:
        aiohttp_errors = (aiohttp.ClientError,)

    retryable = (
        requests.exceptions.RequestException,
        ConnectionError,
        TimeoutError,
        OSError,
        ValueError,
    ) + aiohttp_errors
    for attempt in range(request_max_retries + 1):
        try:
            return operation()
        except retryable as error:
            if attempt >= request_max_retries:
                raise RemoteRequestError(f"{label}连接失败：{error}") from error
            print(
                f"{label}连接失败，等待 {request_retry_delay_milliseconds} ms 后重试",
                file=sys.stderr,
            )
            time.sleep(request_retry_delay_milliseconds / 1000)
    raise AssertionError("request retry loop did not return or raise")


def stock_candidates(frame: Any) -> list[tuple[str, str]]:
    """Normalize code and name columns from exchange or Eastmoney list frames."""
    candidates: dict[str, str] = {}
    for row in frame.to_dict(orient="records"):
        raw_code = row.get("code", row.get("代码", ""))
        raw_name = row.get("name", row.get("名称", ""))
        code = re.sub(r"^(?:SH|SZ|BJ)", "", str(raw_code).strip(), flags=re.IGNORECASE)
        short_name = str(raw_name).strip()
        if code and short_name:
            candidates.setdefault(code, short_name)
    return list(candidates.items())


def load_stock_candidates(
    ak: Any,
    request_max_retries: int,
    request_retry_delay_milliseconds: int,
) -> list[tuple[str, str]]:
    """Use an independent complete A-share list when the exchange aggregate is unavailable."""
    sources = (
        ("沪深京交易所股票列表", "stock_info_a_code_name"),
        ("东方财富沪深京 A 股列表", "stock_zh_a_spot_em"),
        ("腾讯沪深京 A 股列表", "stock_zh_a_spot_tx"),
        ("新浪沪深京 A 股列表", "stock_zh_a_spot"),
    )
    failures: list[str] = []
    for label, function_name in sources:
        try:
            operation = getattr(ak, function_name)

            def load_candidates() -> list[tuple[str, str]]:
                frame = operation()
                candidates = stock_candidates(frame)
                if not candidates:
                    raise ValueError("返回结果没有股票代码和名称")
                return candidates

            candidates = request_with_retry(
                label,
                load_candidates,
                request_max_retries,
                request_retry_delay_milliseconds,
            )
            if failures:
                print(f"已切换到 {label}", file=sys.stderr)
            return candidates
        except Exception as error:
            failures.append(f"{label}: {type(error).__name__}: {error}")
            print(f"{label}不可用：{type(error).__name__}", file=sys.stderr)
    labels = "、".join(label for label, _function_name in sources)
    raise CandidateSourcesUnavailable(f"AKShare 股票列表上游均不可用（{labels}）")


def main() -> None:
    """Read one bridge request from stdin and emit matched company records as JSON."""
    request = json.load(sys.stdin)
    aois = request.get("aois")
    station_title = request.get("stationTitle")
    max_profiles = request.get("maxProfiles")
    insecure_skip_tls_verify = request.get("insecureSkipTlsVerify")
    profile_database_path = request.get("profileDatabasePath")
    request_max_retries = request.get("requestMaxRetries")
    request_retry_delay_milliseconds = request.get("requestRetryDelayMilliseconds")
    if not isinstance(aois, list) or not isinstance(station_title, str) \
            or type(max_profiles) is not int or max_profiles < 1 \
            or not isinstance(insecure_skip_tls_verify, bool) \
            or not isinstance(profile_database_path, str) \
            or type(request_max_retries) is not int \
            or request_max_retries < 0 or request_max_retries > 5 \
            or type(request_retry_delay_milliseconds) is not int \
            or request_retry_delay_milliseconds < 100 \
            or request_retry_delay_milliseconds > 60000:
        raise ValueError("invalid AKShare bridge request")

    if profile_database_path:
        records, diagnostics = load_profile_database(
            profile_database_path,
            aois,
            station_title,
            max_profiles,
        )
        json.dump(
            {"records": records, "cacheUsed": True, "diagnostics": diagnostics},
            sys.stdout,
            ensure_ascii=False,
            allow_nan=False,
        )
        return

    configure_tls(insecure_skip_tls_verify)
    try:
        import akshare as ak
    except ImportError as error:
        raise RuntimeError(
            "未安装 AKShare；请在配置的 Python 环境执行 python -m pip install --upgrade akshare"
        ) from error

    try:
        with contextlib.redirect_stdout(sys.stderr):
            candidates = load_stock_candidates(
                ak,
                request_max_retries,
                request_retry_delay_milliseconds,
            )
    except CandidateSourcesUnavailable as error:
        json.dump({"records": [], "unavailable": str(error)}, sys.stdout, ensure_ascii=False)
        return

    records: list[dict[str, Any]] = []
    attempted_codes: set[str] = set()
    for aoi in aois:
        if not isinstance(aoi, dict) or not isinstance(aoi.get("id"), str):
            continue
        normalized = normalized_aoi_names(aoi)
        matched = next((
            (code, short_name)
            for code, short_name in candidates
            if any(normalized_name(short_name) in name or name in normalized_name(short_name) for name in normalized)
        ), None)
        if matched is None or matched[0] in attempted_codes:
            continue
        code, short_name = matched
        if len(attempted_codes) >= max_profiles:
            break
        attempted_codes.add(code)
        try:
            with contextlib.redirect_stdout(sys.stderr):
                profile_frame = request_with_retry(
                    f"巨潮资讯公司概况 {code}",
                    lambda: ak.stock_profile_cninfo(symbol=code),
                    request_max_retries,
                    request_retry_delay_milliseconds,
                )
        except RemoteRequestError:
            json.dump(
                {"records": [], "unavailable": "AKShare 巨潮资讯公司概况上游不可用"},
                sys.stdout,
                ensure_ascii=False,
            )
            return
        if profile_frame.empty:
            continue
        profile = profile_frame.iloc[0].to_dict()
        if not belongs_to_station(profile, station_title):
            continue
        fields = {
            target: json_value(profile.get(source))
            for source, target in PROFILE_COLUMNS.items()
        }
        fields["stock_code"] = fields.get("stock_code") or code
        fields["stock_name"] = fields.get("stock_name") or short_name
        records.append({"aoiId": aoi["id"], "code": code, "fields": fields})

    json.dump({"records": records}, sys.stdout, ensure_ascii=False, allow_nan=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1) from error
`
