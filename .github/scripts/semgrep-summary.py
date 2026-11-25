#!/usr/bin/env python3
"""Print aggregate Semgrep SARIF counts without exposing finding details."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

VALID_LEVELS = {"error", "warning", "note", "none"}
VALID_KINDS = {"fail", "pass", "open", "informational", "notapplicable", "review"}
SUMMARY_LEVELS = ("errors", "warnings", "notes", "none", "unknown")


def _normalize_level(value: Any) -> str:
    """Normalize a SARIF reporting level, preserving invalid values as unknown."""
    if not isinstance(value, str):
        return "unknown"
    normalized = value.strip().lower()
    return normalized if normalized in VALID_LEVELS else "unknown"


def _object_or_none(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _is_index(value: Any) -> bool:
    """A JSON integer. Booleans are not integers in SARIF, although Python treats them as such."""
    return isinstance(value, int) and not isinstance(value, bool)


def _is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value)


def _tool_parts(run: dict[str, Any]) -> tuple[dict[str, Any], list[Any]]:
    tool = _object_or_none(run.get("tool")) or {}
    driver = _object_or_none(tool.get("driver")) or {}
    extensions = tool.get("extensions", [])
    if not isinstance(extensions, list):
        extensions = []
    return driver, extensions


def _resolve_tool_component(
    run: dict[str, Any], reference: Any
) -> dict[str, Any] | None:
    """Resolve a SARIF toolComponentReference object.

    Every property that is present must be valid. An explicit null, a wrong type
    or an empty GUID is malformed, never a synonym for "absent", so it cannot fall
    back to the driver or to another component. Only an absent reference means
    the driver, and that is decided by _reference_component().
    """
    if not isinstance(reference, dict):
        return None
    driver, extensions = _tool_parts(run)

    if "index" in reference:
        index = reference["index"]
        if not _is_index(index) or not 0 <= index < len(extensions):
            return None
    if "guid" in reference and not _is_nonempty_string(reference["guid"]):
        return None
    if "name" in reference and not isinstance(reference["name"], str):
        return None

    index = reference.get("index")
    guid = reference.get("guid")
    if index is not None:
        component = _object_or_none(extensions[index])
        if component is None:
            return None
        if guid is not None and component.get("guid") != guid:
            return None
    elif guid is not None:
        matches = [
            component
            for component in [driver, *extensions]
            if isinstance(component, dict) and component.get("guid") == guid
        ]
        if len(matches) != 1:
            return None
        component = matches[0]
    else:
        component = driver

    # The name is informational for lookup, but SARIF requires it to match
    # when supplied. Index/GUID, not name, determine component identity.
    if "name" in reference and component.get("name") != reference["name"]:
        return None
    return component


def _reference_component(
    run: dict[str, Any], reference: dict[str, Any]
) -> dict[str, Any] | None:
    """Return the tool component that a reportingDescriptorReference refers to.

    Only an absent toolComponent property means the driver (SARIF's default).
    A present one, including an explicit null, must resolve on its own.
    """
    if "toolComponent" not in reference:
        driver, _ = _tool_parts(run)
        return driver
    return _resolve_tool_component(run, reference["toolComponent"])


def _valid_descriptor_reference(reference: Any) -> bool:
    """Check the property types of a reportingDescriptorReference.

    Both resolution paths use this check: a result's rule reference and an
    invocation override's descriptor. A property that is present must be valid.
    An explicit null, a wrong type, an empty string or a negative index is
    malformed and is never read as "absent", so it cannot redirect the lookup to
    another rule or tool component.
    """
    if not isinstance(reference, dict):
        return False
    if "id" in reference and not _is_nonempty_string(reference["id"]):
        return False
    if "index" in reference and (not _is_index(reference["index"]) or reference["index"] < 0):
        return False
    if "guid" in reference and not _is_nonempty_string(reference["guid"]):
        return False
    if "toolComponent" in reference and not isinstance(reference["toolComponent"], dict):
        return False
    return True


def _valid_descriptor_id(reference_id: Any, descriptor_id: Any) -> bool:
    """Check SARIF's descriptor id / optional one-component subrule relationship."""
    if reference_id is None:
        return True
    if not isinstance(reference_id, str) or not isinstance(descriptor_id, str):
        return False
    if reference_id == descriptor_id:
        return True
    prefix = descriptor_id + "/"
    if not reference_id.startswith(prefix):
        return False
    suffix = reference_id[len(prefix):]
    return bool(suffix) and "/" not in suffix


def _resolve_descriptor(
    component: dict[str, Any],
    reference: dict[str, Any],
    *,
    fallback_index: Any = None,
    expected_result_id: Any = None,
) -> tuple[dict[str, Any], int] | None:
    """Resolve a reportingDescriptor by index/GUID; IDs only validate identity."""
    if not _valid_descriptor_reference(reference):
        return None
    rules = component.get("rules", [])
    if not isinstance(rules, list):
        return None

    if fallback_index is not None and (
        not isinstance(fallback_index, int) or isinstance(fallback_index, bool)
    ):
        return None
    index = reference.get("index")
    if index is None:
        index = fallback_index
    elif fallback_index is not None and index != fallback_index:
        return None

    guid = reference.get("guid")
    if index is not None and (
        not isinstance(index, int) or isinstance(index, bool) or not 0 <= index < len(rules)
    ):
        return None

    by_index: dict[str, Any] | None = None
    if index is not None:
        by_index = _object_or_none(rules[index])
        if by_index is None:
            return None

    by_guid: dict[str, Any] | None = None
    guid_index: int | None = None
    if guid is not None:
        matches = [
            (position, rule)
            for position, rule in enumerate(rules)
            if isinstance(rule, dict) and rule.get("guid") == guid
        ]
        if len(matches) != 1:
            return None
        guid_index, by_guid = matches[0]

    if by_index is not None and by_guid is not None and index != guid_index:
        return None
    descriptor_index = index if index is not None else guid_index
    descriptor = rules[descriptor_index] if descriptor_index is not None else None
    descriptor = _object_or_none(descriptor)
    if descriptor is None:
        # An explicit descriptor reference needs an index or GUID to identify
        # metadata; its id only validates identity. The one ID-based lookup is
        # the controlled ruleId-only fallback in _resolve_by_exact_rule_id().
        return None

    descriptor_id = descriptor.get("id")
    reference_id = reference.get("id")
    if not _valid_descriptor_id(reference_id, descriptor_id):
        return None
    if not _valid_descriptor_id(expected_result_id, descriptor_id):
        return None
    return descriptor, descriptor_index


def _resolve_by_exact_rule_id(
    run: dict[str, Any], rule_id: str
) -> tuple[str, tuple[dict[str, Any], dict[str, Any], int] | None]:
    """Controlled fallback for a result that names its rule only by ruleId.

    Semgrep's SARIF results carry a ruleId but no ruleIndex and no rule
    reference. Without a reference there is no toolComponent, so the rule
    belongs to tool.driver; its rules array is searched by exact,
    case-sensitive equality with reportingDescriptor.id:
      * exactly one match resolves to that descriptor;
      * no match keeps the missing-descriptor behaviour (SARIF's default warning);
      * several matches are ambiguous, so the level is unknown. The first
        match is never chosen.
    A malformed tool, driver or rules array, or any malformed descriptor in
    it, makes the level unknown, because the malformed entry could be the
    intended rule.
    """
    tool = run.get("tool")
    driver = tool.get("driver") if isinstance(tool, dict) else None
    if not isinstance(driver, dict):
        return "invalid", None
    if "rules" not in driver:
        return "missing", None
    rules = driver["rules"]
    if not isinstance(rules, list):
        return "invalid", None

    matches: list[tuple[int, dict[str, Any]]] = []
    for position, rule in enumerate(rules):
        if not isinstance(rule, dict) or not _is_nonempty_string(rule.get("id")):
            return "invalid", None
        if rule["id"] == rule_id:
            matches.append((position, rule))

    if not matches:
        return "missing", None
    if len(matches) > 1:
        return "invalid", None
    position, descriptor = matches[0]
    return "resolved", (driver, descriptor, position)


def _result_descriptor(
    run: dict[str, Any], result: dict[str, Any]
) -> tuple[str, tuple[dict[str, Any], dict[str, Any], int] | None]:
    """Resolve a rule descriptor, distinguishing absent metadata from bad references."""
    # An explicit null rule reference is malformed, not absent.
    if "rule" in result and not _valid_descriptor_reference(result["rule"]):
        return "invalid", None
    rule_reference = result.get("rule", {})

    if "ruleId" in result and not _is_nonempty_string(result["ruleId"]):
        return "invalid", None
    if "ruleIndex" in result and (
        not _is_index(result["ruleIndex"]) or result["ruleIndex"] < 0
    ):
        return "invalid", None

    rule_id = result.get("ruleId")
    reference_id = rule_reference.get("id")
    if rule_id is not None and reference_id is not None and rule_id != reference_id:
        return "invalid", None
    expected_id = reference_id if reference_id is not None else rule_id

    # An explicit index/GUID asserts that descriptor metadata exists and must
    # resolve consistently; it is never replaced by an ID lookup. An explicit
    # reportingDescriptorReference containing only an id is valid without
    # metadata and keeps SARIF's default warning.
    has_descriptor_identity = (
        "index" in rule_reference
        or "guid" in rule_reference
        or "ruleIndex" in result
    )
    if "toolComponent" in rule_reference and not has_descriptor_identity:
        return "invalid", None
    if not has_descriptor_identity:
        # Only a result with no rule reference and no ruleIndex at all uses the
        # exact-ID fallback. By this point every present reference property has
        # been validated, so the fallback can never stand in for a malformed one.
        if "rule" not in result and rule_id is not None:
            return _resolve_by_exact_rule_id(run, rule_id)
        return "missing", None

    component = _reference_component(run, rule_reference)
    if component is None:
        return "invalid", None

    resolved = _resolve_descriptor(
        component,
        rule_reference,
        fallback_index=result.get("ruleIndex"),
        expected_result_id=expected_id,
    )
    if resolved is None:
        return "invalid", None
    descriptor, descriptor_index = resolved
    return "resolved", (component, descriptor, descriptor_index)


def _invocation_override_level(
    run: dict[str, Any],
    result: dict[str, Any],
    target_component: dict[str, Any],
    target_descriptor: dict[str, Any],
    target_index: int,
) -> str | None:
    """Resolve only the invocation identified by result.provenance.invocationIndex."""
    if "provenance" in result and not isinstance(result["provenance"], dict):
        return "unknown"
    provenance = result.get("provenance", {})

    invocation_index: int | None = None
    if "invocationIndex" in provenance:
        invocation_index = provenance["invocationIndex"]
        # SARIF 2.1.0: an integer with minimum -1, where -1 means the invocation
        # is unknown, so no invocation override applies. Booleans and nulls are
        # not integers, and anything below -1 is invalid.
        if not _is_index(invocation_index):
            return "unknown"
        if invocation_index == -1:
            return None
        if invocation_index < -1:
            return "unknown"

    if "invocations" not in run:
        # A non-negative index must name an invocation, and there are none.
        return None if invocation_index is None else "unknown"
    invocations = run["invocations"]
    if not isinstance(invocations, list):
        return "unknown"

    if invocation_index is None:
        # SARIF defaults to invocation 0 only when exactly one invocation exists.
        if len(invocations) != 1:
            return None
        invocation_index = 0
    if invocation_index >= len(invocations):
        return "unknown"

    invocation = _object_or_none(invocations[invocation_index])
    if invocation is None:
        return "unknown"
    overrides = invocation.get("ruleConfigurationOverrides", [])
    if not isinstance(overrides, list):
        return "unknown"

    matched_levels: list[str] = []
    matched_override_count = 0
    for override in overrides:
        if not isinstance(override, dict):
            return "unknown"
        # The descriptor is required. It gets the same checks as a result's rule
        # reference, so an explicit null toolComponent (or any other malformed
        # property) cannot fall back to the driver or match another rule.
        reference = override.get("descriptor")
        if not _valid_descriptor_reference(reference):
            return "unknown"

        component = _reference_component(run, reference)
        if component is None:
            return "unknown"
        resolved = _resolve_descriptor(component, reference)
        if resolved is None:
            return "unknown"
        descriptor, descriptor_index = resolved
        if component is not target_component or descriptor_index != target_index:
            continue
        if descriptor is not target_descriptor:
            return "unknown"

        matched_override_count += 1
        configuration = override.get("configuration")
        if not isinstance(configuration, dict):
            return "unknown"
        if "level" in configuration:
            matched_levels.append(_normalize_level(configuration["level"]))

    if matched_override_count > 1:
        return "unknown"
    if not matched_levels:
        return None
    return matched_levels[0]


def resolve_result_level(run: dict[str, Any], result: dict[str, Any]) -> str:
    """Resolve a finding's effective severity using SARIF 2.1.0 precedence."""
    kind = result.get("kind", "fail")
    if not isinstance(kind, str) or kind.strip().lower() not in VALID_KINDS:
        return "unknown"
    normalized_kind = kind.strip().lower()
    if normalized_kind != "fail":
        # SARIF requires non-fail results to have level "none" (or omit it).
        if "level" not in result:
            return "none"
        return "none" if result["level"] == "none" else "unknown"

    # A result-level value takes precedence over invocation and rule settings.
    if "level" in result:
        return _normalize_level(result["level"])

    resolution, resolved = _result_descriptor(run, result)
    if resolution == "invalid":
        return "unknown"
    if resolution == "missing" or resolved is None:
        # No descriptor metadata: an id-only rule reference, a ruleId that
        # matches no driver rule, or no rule identity at all. SARIF therefore
        # supplies the default reporting level of warning.
        return "warning"
    component, descriptor, descriptor_index = resolved

    invocation_level = _invocation_override_level(
        run, result, component, descriptor, descriptor_index
    )
    if invocation_level is not None:
        return invocation_level

    default_configuration = descriptor.get("defaultConfiguration", {})
    if not isinstance(default_configuration, dict):
        return "unknown"
    if "level" in default_configuration:
        return _normalize_level(default_configuration["level"])

    # SARIF 2.1.0 defaults reportingConfiguration.level to "warning".
    return "warning"


def summarize_document(document: Any) -> dict[str, int]:
    """Return aggregate severity counts for all SARIF runs."""
    if not isinstance(document, dict) or not isinstance(document.get("runs"), list):
        raise ValueError("SARIF document must contain a runs array.")

    counts = {name: 0 for name in SUMMARY_LEVELS}
    counts["total"] = 0

    for run in document["runs"]:
        if not isinstance(run, dict):
            raise ValueError("Each SARIF run must be an object.")
        results = run.get("results", [])
        if not isinstance(results, list):
            raise ValueError("Each SARIF run results value must be an array.")
        for result in results:
            if not isinstance(result, dict):
                raise ValueError("Each SARIF result must be an object.")
            level = resolve_result_level(run, result)
            bucket = {
                "error": "errors",
                "warning": "warnings",
                "note": "notes",
                "none": "none",
                "unknown": "unknown",
            }[level]
            counts[bucket] += 1
            counts["total"] += 1

    return counts


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if len(arguments) != 1:
        print("Semgrep summary could not read its input.", file=sys.stderr)
        return 2

    sarif_path = Path(arguments[0])
    try:
        document = json.loads(sarif_path.read_text(encoding="utf-8-sig"))
        counts = summarize_document(document)
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, AttributeError, ValueError):
        print("Semgrep SARIF summary is unavailable or invalid.", file=sys.stderr)
        return 2

    print(
        "Semgrep findings (details withheld): "
        f"total={counts['total']} "
        f"errors={counts['errors']} "
        f"warnings={counts['warnings']} "
        f"notes={counts['notes']} "
        f"none={counts['none']} "
        f"unknown={counts['unknown']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())