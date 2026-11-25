#!/usr/bin/env python3
"""Regression tests for Semgrep SARIF severity aggregation."""

import importlib.util
import unittest
from pathlib import Path

SUMMARY_PATH = Path(__file__).with_name("semgrep-summary.py")
SPEC = importlib.util.spec_from_file_location("semgrep_summary", SUMMARY_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load semgrep-summary.py for tests.")
SUMMARY_MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SUMMARY_MODULE)
resolve_result_level = SUMMARY_MODULE.resolve_result_level
summarize_document = SUMMARY_MODULE.summarize_document

DRIVER_GUID = "11111111-1111-4111-8111-111111111111"
EXTENSION_GUID = "22222222-2222-4222-8222-222222222222"
RULE_GUID = "33333333-3333-4333-8333-333333333333"
EXT_RULE_GUID = "44444444-4444-4444-8444-444444444444"


def make_run(rule_level="warning", rule_id="RULE-1", rule_name="Semgrep"):
    return {
        "tool": {
            "driver": {
                "name": rule_name,
                "guid": DRIVER_GUID,
                "rules": [
                    {
                        "id": rule_id,
                        "guid": RULE_GUID,
                        "defaultConfiguration": {"level": rule_level} if rule_level else {},
                    }
                ],
            }
        },
        "results": [],
    }


def result_ref(**extra):
    return {"ruleId": "RULE-1", "ruleIndex": 0, **extra}


def override_ref(level, *, index=0, guid=None, component=None):
    descriptor = {"index": index}
    if guid is not None:
        descriptor["guid"] = guid
    if component is not None:
        descriptor["toolComponent"] = component
    return {"descriptor": descriptor, "configuration": {"level": level}}


class SemgrepSummaryTests(unittest.TestCase):
    def test_explicit_result_level_has_highest_precedence(self):
        run = make_run("note")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("warning")]}]
        self.assertEqual(resolve_result_level(run, result_ref(level="ERROR", provenance={"invocationIndex": 0})), "error")

    def test_invocation_override_precedes_rule_default(self):
        run = make_run("warning")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error")]}]
        self.assertEqual(resolve_result_level(run, result_ref(provenance={"invocationIndex": 0})), "error")

    def test_conflicting_invocation_overrides_are_unknown(self):
        run = make_run("warning")
        run["invocations"] = [{
            "ruleConfigurationOverrides": [override_ref("error"), override_ref("note")]
        }]
        self.assertEqual(resolve_result_level(run, result_ref(provenance={"invocationIndex": 0})), "unknown")

    def test_single_invocation_defaults_to_invocation_zero(self):
        run = make_run("warning")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error")]}]
        self.assertEqual(resolve_result_level(run, result_ref()), "error")

    def test_multiple_invocations_require_result_provenance(self):
        run = make_run("note")
        run["invocations"] = [
            {"ruleConfigurationOverrides": [override_ref("error")]},
            {"ruleConfigurationOverrides": [override_ref("warning")]},
        ]
        self.assertEqual(resolve_result_level(run, result_ref()), "note")
        self.assertEqual(resolve_result_level(run, result_ref(provenance={"invocationIndex": 1})), "warning")

    def test_negative_invocation_index_uses_rule_default(self):
        run = make_run("note")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error")]}]
        self.assertEqual(resolve_result_level(run, result_ref(provenance={"invocationIndex": -1})), "note")

    def test_out_of_range_invocation_index_is_unknown(self):
        run = make_run("warning")
        run["invocations"] = [{}]
        self.assertEqual(resolve_result_level(run, result_ref(provenance={"invocationIndex": 4})), "unknown")

    def test_rule_default_configuration_is_used_when_result_level_is_missing(self):
        run = make_run("note")
        self.assertEqual(resolve_result_level(run, result_ref()), "note")

    def test_missing_rule_metadata_defaults_to_warning(self):
        # Changed with the exact-ID fallback: a ruleId that matches no driver
        # rule still has no metadata, so SARIF's default warning applies. (A
        # unique match now resolves; see the exact ruleId fallback tests.)
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-404"}), "warning")

    def test_sarif_default_level_is_warning_when_rule_has_no_level(self):
        run = make_run(None)
        self.assertEqual(resolve_result_level(run, result_ref()), "warning")

    def test_override_without_level_preserves_rule_default(self):
        run = make_run("note")
        run["invocations"] = [{
            "ruleConfigurationOverrides": [{
                "descriptor": {"index": 0},
                "configuration": {"enabled": True},
            }]
        }]
        self.assertEqual(resolve_result_level(run, result_ref(provenance={"invocationIndex": 0})), "note")

    def test_duplicate_rule_ids_are_disambiguated_by_index(self):
        run = make_run("warning")
        run["tool"]["driver"]["rules"].append({
            "id": "RULE-1",
            "guid": "55555555-5555-4555-8555-555555555555",
            "defaultConfiguration": {"level": "error"},
        })
        result = {"ruleId": "RULE-1", "rule": {"index": 1}}
        self.assertEqual(resolve_result_level(run, result), "error")

    def test_invalid_rule_default_level_is_unknown(self):
        run = make_run("critical")
        self.assertEqual(resolve_result_level(run, result_ref()), "unknown")

    def test_result_rule_guid_resolves_descriptor(self):
        run = make_run("error")
        result = {"ruleId": "RULE-1", "rule": {"guid": RULE_GUID}}
        self.assertEqual(resolve_result_level(run, result), "error")

    def test_rule_index_and_guid_must_identify_same_descriptor(self):
        run = make_run("error")
        run["tool"]["driver"]["rules"].append({"id": "RULE-2", "guid": "55555555-5555-4555-8555-555555555555"})
        result = {"ruleId": "RULE-1", "rule": {"index": 0, "guid": "55555555-5555-4555-8555-555555555555"}}
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_rule_id_must_match_rule_reference_id(self):
        run = make_run("error")
        result = {"ruleId": "RULE-1", "rule": {"id": "RULE-2", "index": 0}}
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_result_rule_index_must_match_rule_reference_index(self):
        run = make_run("error")
        run["tool"]["driver"]["rules"].append({"id": "RULE-2"})
        result = {"ruleId": "RULE-1", "ruleIndex": 1, "rule": {"index": 0}}
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_invocation_override_matches_descriptor_guid(self):
        run = make_run("warning")
        run["invocations"] = [{
            "ruleConfigurationOverrides": [{
                "descriptor": {"guid": RULE_GUID},
                "configuration": {"level": "error"},
            }]
        }]
        self.assertEqual(resolve_result_level(run, result_ref(provenance={"invocationIndex": 0})), "error")

    def test_extension_rule_resolves_by_tool_component_index(self):
        run = make_run("warning")
        run["tool"]["extensions"] = [{
            "name": "custom-rules",
            "guid": EXTENSION_GUID,
            "rules": [{"id": "EXT-1", "guid": EXT_RULE_GUID, "defaultConfiguration": {"level": "error"}}],
        }]
        result = {
            "ruleId": "EXT-1",
            "rule": {"index": 0, "toolComponent": {"index": 0, "name": "custom-rules"}},
        }
        self.assertEqual(resolve_result_level(run, result), "error")

    def test_extension_rule_resolves_by_tool_component_guid(self):
        run = make_run("warning")
        run["tool"]["extensions"] = [{
            "name": "custom-rules",
            "guid": EXTENSION_GUID,
            "rules": [{"id": "EXT-1", "guid": EXT_RULE_GUID, "defaultConfiguration": {"level": "note"}}],
        }]
        result = {
            "ruleId": "EXT-1",
            "rule": {"guid": EXT_RULE_GUID, "toolComponent": {"guid": EXTENSION_GUID}},
        }
        self.assertEqual(resolve_result_level(run, result), "note")

    def test_extension_invocation_override_matches_component_and_rule_guids(self):
        run = make_run("warning")
        run["tool"]["extensions"] = [{
            "name": "custom-rules",
            "guid": EXTENSION_GUID,
            "rules": [{"id": "EXT-1", "guid": EXT_RULE_GUID, "defaultConfiguration": {"level": "warning"}}],
        }]
        run["invocations"] = [{
            "ruleConfigurationOverrides": [override_ref(
                "error", guid=EXT_RULE_GUID,
                component={"guid": EXTENSION_GUID, "name": "custom-rules"},
            )]
        }]
        result = {
            "ruleId": "EXT-1",
            "rule": {"guid": EXT_RULE_GUID, "toolComponent": {"index": 0}},
            "provenance": {"invocationIndex": 0},
        }
        self.assertEqual(resolve_result_level(run, result), "error")

    def test_invalid_component_reference_is_counted_as_unknown(self):
        run = make_run("warning")
        run["tool"]["extensions"] = [{"name": "ext", "guid": EXTENSION_GUID, "rules": []}]
        result = {"ruleId": "RULE-1", "rule": {"index": 0, "toolComponent": {"index": 0, "guid": "99999999-9999-4999-8999-999999999999"}}}
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_non_fail_result_kind_is_counted_as_none(self):
        run = make_run("error")
        for kind in ("pass", "open", "informational", "notApplicable", "review"):
            self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "kind": kind}), "none")

    def test_non_fail_result_with_incompatible_level_is_unknown(self):
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "kind": "pass", "level": "error"}), "unknown")

    def test_non_fail_result_with_explicit_null_level_is_unknown(self):
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, result_ref(kind="pass", level=None)), "unknown")

    def test_explicit_none_level_is_counted_as_none(self):
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, result_ref(level="none")), "none")

    def test_unknown_level_is_counted_as_unknown(self):
        run = make_run("warning")
        self.assertEqual(resolve_result_level(run, result_ref(level="fatal")), "unknown")

    def test_absent_is_not_a_valid_result_kind(self):
        run = make_run("warning")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "kind": "absent"}), "unknown")

    def test_unknown_result_kind_is_counted_as_unknown(self):
        run = make_run("warning")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "kind": "unexpected"}), "unknown")


    def test_out_of_range_result_rule_index_is_unknown(self):
        run = make_run("error")
        result = {"ruleId": "RULE-1", "ruleIndex": 7}
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_explicit_null_result_level_is_unknown_not_absent(self):
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, result_ref(level=None)), "unknown")

    def test_explicit_null_invocation_index_is_unknown(self):
        run = make_run("warning")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error")]}]
        result = result_ref(provenance={"invocationIndex": None})
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_absent_kind_defaults_to_fail(self):
        run = make_run("error")
        result = {"ruleId": "RULE-1", "ruleIndex": 0}
        self.assertNotIn("kind", result)
        self.assertEqual(resolve_result_level(run, result), "error")

    def test_id_only_rule_reference_without_metadata_defaults_to_warning(self):
        run = make_run("error")
        result = {"ruleId": "RULE-1", "rule": {"id": "RULE-1"}}
        self.assertEqual(resolve_result_level(run, result), "warning")

    def test_multiple_runs_are_aggregated(self):
        first = make_run("error")
        first["results"] = [result_ref(), {"ruleId": "RULE-1", "kind": "pass"}]
        second = make_run("note", rule_id="RULE-2")
        second["results"] = [result_ref(ruleId="RULE-2"), {"ruleId": "missing"}]
        self.assertEqual(
            summarize_document({"version": "2.1.0", "runs": [first, second]}),
            {"errors": 1, "warnings": 1, "notes": 1, "none": 1, "unknown": 0, "total": 4},
        )

    def test_invalid_document_is_rejected(self):
        with self.assertRaises(ValueError):
            summarize_document({"version": "2.1.0"})

    def test_invalid_result_shape_is_rejected(self):
        with self.assertRaises(ValueError):
            summarize_document({"runs": [{"results": ["not-an-object"]}]})

    # ── invocationIndex: -1 means unknown; below -1 is invalid; >= 0 must exist ──

    def test_invocation_index_below_minus_one_is_unknown(self):
        run = make_run("note")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error")]}]
        for index in (-2, -10):
            with self.subTest(invocationIndex=index):
                result = result_ref(provenance={"invocationIndex": index})
                self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_minus_one_invocation_index_without_invocations_uses_rule_default(self):
        run = make_run("note")
        self.assertNotIn("invocations", run)
        result = result_ref(provenance={"invocationIndex": -1})
        self.assertEqual(resolve_result_level(run, result), "note")

    def test_non_negative_invocation_index_without_invocations_is_unknown(self):
        run = make_run("note")
        self.assertNotIn("invocations", run)
        result = result_ref(provenance={"invocationIndex": 0})
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_boolean_invocation_index_is_unknown(self):
        # True == 1 and False == 0 in Python; neither may select an invocation.
        run = make_run("note")
        run["invocations"] = [
            {"ruleConfigurationOverrides": [override_ref("error")]},
            {"ruleConfigurationOverrides": [override_ref("warning")]},
        ]
        for index in (True, False):
            with self.subTest(invocationIndex=index):
                result = result_ref(provenance={"invocationIndex": index})
                self.assertEqual(resolve_result_level(run, result), "unknown")

    # ── Explicit null references are malformed, never "absent" ──

    def test_explicit_null_override_descriptor_is_unknown(self):
        run = make_run("note")
        run["invocations"] = [{
            "ruleConfigurationOverrides": [{"descriptor": None, "configuration": {"level": "error"}}]
        }]
        result = result_ref(provenance={"invocationIndex": 0})
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_explicit_null_result_rule_reference_is_unknown(self):
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "rule": None}), "unknown")

    def test_explicit_null_tool_component_in_result_rule_is_unknown(self):
        run = make_run("error")
        result = {"ruleId": "RULE-1", "rule": {"index": 0, "toolComponent": None}}
        self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_explicit_null_tool_component_in_override_is_unknown(self):
        # Before the fix this silently resolved to the driver and applied "error".
        run = make_run("note")
        override = override_ref("error")
        override["descriptor"]["toolComponent"] = None
        run["invocations"] = [{"ruleConfigurationOverrides": [override]}]
        result = result_ref(provenance={"invocationIndex": 0})
        self.assertEqual(resolve_result_level(run, result), "unknown")

    # ── An absent toolComponent keeps its valid default: the driver ──

    def test_absent_tool_component_in_result_rule_defaults_to_driver(self):
        run = make_run("note")
        run["tool"]["extensions"] = [{
            "name": "custom-rules",
            "guid": EXTENSION_GUID,
            "rules": [{"id": "EXT-1", "guid": EXT_RULE_GUID, "defaultConfiguration": {"level": "error"}}],
        }]
        result = {"ruleId": "RULE-1", "rule": {"index": 0}}
        self.assertNotIn("toolComponent", result["rule"])
        self.assertEqual(resolve_result_level(run, result), "note")

    def test_override_without_tool_component_applies_only_to_driver_rule(self):
        run = make_run("note")
        run["tool"]["extensions"] = [{
            "name": "custom-rules",
            "guid": EXTENSION_GUID,
            "rules": [{"id": "EXT-1", "guid": EXT_RULE_GUID, "defaultConfiguration": {"level": "warning"}}],
        }]
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error")]}]
        driver_result = result_ref(provenance={"invocationIndex": 0})
        extension_result = {
            "ruleId": "EXT-1",
            "rule": {"index": 0, "toolComponent": {"index": 0}},
            "provenance": {"invocationIndex": 0},
        }
        self.assertEqual(resolve_result_level(run, driver_result), "error")
        self.assertEqual(resolve_result_level(run, extension_result), "warning")

    # ── Both resolution paths reject the same malformed references ──

    MALFORMED_TOOL_COMPONENTS = (
        {"index": None},
        {"guid": None},
        {"name": None},
        {"index": -1},
        {"index": "0"},
        {"index": True},
        {"guid": ""},
        {"guid": 7},
    )

    def test_malformed_tool_component_in_result_rule_does_not_fall_back_to_driver(self):
        # The driver's rule 0 is RULE-1, so a fallback to the driver would
        # silently resolve this reference and report "note".
        run = make_run("note")
        run["tool"]["extensions"] = [{
            "name": "custom-rules",
            "guid": EXTENSION_GUID,
            "rules": [{"id": "EXT-1", "guid": EXT_RULE_GUID, "defaultConfiguration": {"level": "error"}}],
        }]
        for component in self.MALFORMED_TOOL_COMPONENTS:
            with self.subTest(toolComponent=component):
                result = {"ruleId": "RULE-1", "rule": {"index": 0, "toolComponent": component}}
                self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_malformed_tool_component_in_override_does_not_fall_back_to_driver(self):
        for component in self.MALFORMED_TOOL_COMPONENTS:
            with self.subTest(toolComponent=component):
                run = make_run("note")
                run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error", component=component)]}]
                result = result_ref(provenance={"invocationIndex": 0})
                self.assertEqual(resolve_result_level(run, result), "unknown")

    MALFORMED_DESCRIPTOR_REFERENCES = (
        {"index": None, "guid": RULE_GUID},
        {"index": 0, "guid": None},
        {"index": 0, "id": None},
        {"index": 0, "id": ""},
        {"index": "0"},
        {"index": False},
        {"index": -1, "guid": RULE_GUID},
    )

    def test_malformed_override_descriptor_reference_is_unknown(self):
        for descriptor in self.MALFORMED_DESCRIPTOR_REFERENCES:
            with self.subTest(descriptor=descriptor):
                run = make_run("note")
                run["invocations"] = [{
                    "ruleConfigurationOverrides": [{"descriptor": descriptor, "configuration": {"level": "error"}}]
                }]
                result = result_ref(provenance={"invocationIndex": 0})
                self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_malformed_result_rule_reference_is_unknown(self):
        run = make_run("error")
        for reference in self.MALFORMED_DESCRIPTOR_REFERENCES:
            with self.subTest(rule=reference):
                self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "rule": reference}), "unknown")

    # ── Exact ruleId fallback (results with no rule reference and no ruleIndex) ──

    def test_unique_exact_rule_id_resolves_driver_descriptor(self):
        run = make_run("error")
        run["tool"]["driver"]["rules"].append({"id": "RULE-2", "defaultConfiguration": {"level": "note"}})
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-2"}), "note")

    def test_exact_rule_id_match_is_case_sensitive_and_not_hierarchical(self):
        run = make_run("error")
        for rule_id in ("rule-1", "RULE-1 ", "RULE-1/sub", "RULE"):
            with self.subTest(ruleId=rule_id):
                self.assertEqual(resolve_result_level(run, {"ruleId": rule_id}), "warning")

    def test_exact_rule_id_reports_each_rule_level(self):
        # Semgrep ERROR, WARNING and INFO map to SARIF error, warning and note.
        for level in ("error", "warning", "note"):
            with self.subTest(level=level):
                self.assertEqual(resolve_result_level(make_run(level), {"ruleId": "RULE-1"}), level)

    def test_semgrep_shaped_document_reports_actual_rule_levels(self):
        # The shape of the pinned image's output: ruleId only, one invocation
        # with no rule configuration overrides, levels on the descriptors.
        run = {
            "tool": {"driver": {"name": "Semgrep OSS", "rules": [
                {"id": "semgrep.rule-error", "defaultConfiguration": {"level": "error"}},
                {"id": "semgrep.rule-warning", "defaultConfiguration": {"level": "warning"}},
                {"id": "semgrep.rule-note", "defaultConfiguration": {"level": "note"}},
            ]}},
            "invocations": [{"executionSuccessful": True, "toolExecutionNotifications": []}],
            "results": [
                {"ruleId": "semgrep.rule-error"},
                {"ruleId": "semgrep.rule-error"},
                {"ruleId": "semgrep.rule-warning"},
                {"ruleId": "semgrep.rule-note"},
                {"ruleId": "semgrep.rule-not-in-driver"},
            ],
        }
        self.assertEqual(
            summarize_document({"version": "2.1.0", "runs": [run]}),
            {"errors": 2, "warnings": 2, "notes": 1, "none": 0, "unknown": 0, "total": 5},
        )

    def test_driver_without_rules_keeps_warning_default(self):
        run = make_run("error")
        del run["tool"]["driver"]["rules"]
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "warning")

    def test_duplicate_exact_rule_ids_are_unknown(self):
        # Never the first match: the duplicates carry different levels.
        run = make_run("warning")
        run["tool"]["driver"]["rules"].append({"id": "RULE-1", "defaultConfiguration": {"level": "error"}})
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "unknown")

    def test_malformed_rules_array_is_unknown(self):
        valid = {"id": "RULE-1", "defaultConfiguration": {"level": "error"}}
        malformed_rules = (
            None,
            {"RULE-1": valid},
            "RULE-1",
            7,
            ["not-an-object", valid],
            [{"id": None}, valid],
            [{"name": "no id"}, valid],
            [{"id": ""}, valid],
            [{"id": 7}, valid],
        )
        for rules in malformed_rules:
            with self.subTest(rules=rules):
                run = make_run("error")
                run["tool"]["driver"]["rules"] = rules
                self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "unknown")

    def test_malformed_tool_or_driver_is_unknown_for_exact_id_lookup(self):
        for tool in (None, "Semgrep", {"driver": None}, {"driver": ["not-an-object"]}):
            with self.subTest(tool=tool):
                run = make_run("error")
                run["tool"] = tool
                self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "unknown")
        run = make_run("error")
        del run["tool"]
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "unknown")

    def test_explicit_null_rule_reference_does_not_use_exact_id_fallback(self):
        # RULE-1 matches exactly one ERROR rule, but the explicit null reference
        # is malformed and must not be bypassed by the ID lookup.
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "rule": None}), "unknown")

    def test_id_only_rule_reference_does_not_use_exact_id_fallback(self):
        # An explicit reference without index or GUID keeps SARIF's default.
        run = make_run("error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "rule": {"id": "RULE-1"}}), "warning")

    def test_malformed_explicit_references_never_fall_back_to_rule_id(self):
        run = make_run("error")
        malformed_results = (
            {"ruleId": "RULE-1", "ruleIndex": -1},
            {"ruleId": "RULE-1", "ruleIndex": None},
            {"ruleId": "RULE-1", "ruleIndex": "0"},
            {"ruleId": "RULE-1", "ruleIndex": True},
            {"ruleId": "RULE-1", "ruleIndex": 7},
            {"ruleId": "RULE-1", "rule": {"index": None}},
            {"ruleId": "RULE-1", "rule": {"guid": None}},
            {"ruleId": "RULE-1", "rule": {"id": None}},
            {"ruleId": "RULE-1", "rule": {"toolComponent": None}},
            {"ruleId": "RULE-1", "rule": {"index": 0, "toolComponent": None}},
            {"ruleId": "RULE-1", "rule": {"index": 0, "toolComponent": {"index": None}}},
            {"ruleId": "RULE-1", "rule": "RULE-1"},
            {"ruleId": ""},
            {"ruleId": 7},
            {"ruleId": None},
        )
        for result in malformed_results:
            with self.subTest(result=result):
                self.assertEqual(resolve_result_level(run, result), "unknown")

    def test_rule_index_resolution_is_unchanged_by_exact_id_fallback(self):
        run = make_run("warning")
        run["tool"]["driver"]["rules"].append({"id": "RULE-1", "defaultConfiguration": {"level": "error"}})
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "ruleIndex": 1}), "error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "ruleIndex": 0}), "warning")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "rule": {"index": 1}}), "error")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "unknown")

    def test_invocation_override_applies_to_exact_id_match(self):
        run = make_run("note")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("error")]}]
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "error")
        unknown_invocation = {"ruleId": "RULE-1", "provenance": {"invocationIndex": -1}}
        self.assertEqual(resolve_result_level(run, unknown_invocation), "note")

    def test_explicit_result_level_and_kind_precede_exact_id_match(self):
        run = make_run("error")
        run["invocations"] = [{"ruleConfigurationOverrides": [override_ref("warning")]}]
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "level": "note"}), "note")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1", "kind": "pass"}), "none")
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "warning")

    def test_exact_id_lookup_uses_driver_only(self):
        # No rule reference means no toolComponent, so extensions are never searched.
        run = make_run("note")
        run["tool"]["extensions"] = [{
            "name": "custom-rules",
            "guid": EXTENSION_GUID,
            "rules": [
                {"id": "RULE-1", "defaultConfiguration": {"level": "error"}},
                {"id": "EXT-ONLY", "defaultConfiguration": {"level": "error"}},
            ],
        }]
        self.assertEqual(resolve_result_level(run, {"ruleId": "RULE-1"}), "note")
        self.assertEqual(resolve_result_level(run, {"ruleId": "EXT-ONLY"}), "warning")


if __name__ == "__main__":
    unittest.main(verbosity=2)