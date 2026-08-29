/** Trusted Python program embedded in the published JavaScript bundle. */
export const AKSHARE_BRIDGE = String.raw`"""Resolve station enterprise AOIs against AKShare A-share company profiles."""

from __future__ import annotations

import contextlib
import json
import re
import sys
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


def normalized_name(value: object) -> str:
    """Normalize company display text for deterministic short-name matching."""
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]", "", str(value)).upper()


def station_tokens(value: str) -> list[str]:
    """Keep city and district tokens so broad city names do not admit neighboring districts."""
    title = re.sub(r"(?:局点|站点)$", "", value.strip())
    tokens = re.findall(r"[^省市区县]+[省市区县]", title)
    return tokens or ([title] if title else [])


def belongs_to_station(profile: dict[str, object], title: str) -> bool:
    """Require every available station token in either registered or office address."""
    addresses = f"{profile.get('注册地址', '')} {profile.get('办公地址', '')}"
    tokens = station_tokens(title)
    return bool(tokens) and all(token in addresses for token in tokens)


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


def main() -> None:
    """Read one bridge request from stdin and emit matched company records as JSON."""
    request = json.load(sys.stdin)
    aois = request.get("aois")
    station_title = request.get("stationTitle")
    max_profiles = request.get("maxProfiles")
    insecure_skip_tls_verify = request.get("insecureSkipTlsVerify")
    if not isinstance(aois, list) or not isinstance(station_title, str) \
            or not isinstance(max_profiles, int) or max_profiles < 1 \
            or not isinstance(insecure_skip_tls_verify, bool):
        raise ValueError("invalid AKShare bridge request")

    configure_tls(insecure_skip_tls_verify)
    try:
        import akshare as ak
    except ImportError as error:
        raise RuntimeError(
            "未安装 AKShare；请在配置的 Python 环境执行 python -m pip install --upgrade akshare"
        ) from error

    with contextlib.redirect_stdout(sys.stderr):
        stocks = ak.stock_info_a_code_name()
    candidates: list[tuple[str, str]] = []
    for row in stocks.to_dict(orient="records"):
        code = str(row.get("code", "")).strip()
        short_name = str(row.get("name", "")).strip()
        if code and short_name:
            candidates.append((code, short_name))

    records: list[dict[str, Any]] = []
    attempted_codes: set[str] = set()
    for aoi in aois:
        if not isinstance(aoi, dict) or not isinstance(aoi.get("id"), str):
            continue
        names = [aoi.get("name"), *(aoi.get("aliases") or [])]
        normalized = [
            item for value in names if isinstance(value, str)
            if (item := normalized_name(value))
        ]
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
        with contextlib.redirect_stdout(sys.stderr):
            profile_frame = ak.stock_profile_cninfo(symbol=code)
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
