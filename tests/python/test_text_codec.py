"""Unit tests for the ue_text_codec prelude (arch-review W1 proof point).

The text codec (`server/editor/scripts/ue_text_codec/00_text_codec.py`) is
the ideal first unit-test target: `decode_template_arg` / `unreal_text` are
pure flows every tool call funnels through (base64-of-JSON `jsonArg`
payloads), and the file needs only `import unreal`, which `mock_unreal`
stubs. Loading the real prelude file through `prelude_runner` proves the
mock approach instead of re-implementing the logic in the test.

Run:  python3 -m unittest discover -s tests/python -v
"""

import base64
import json
import unittest

from prelude_runner import load_package


def _encode(value):
    return base64.b64encode(json.dumps(value).encode("utf-8")).decode("ascii")


class TextCodecTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ns = load_package("ue_text_codec")

    def test_decode_round_trip(self):
        decode = self.ns["decode_template_arg"]
        self.assertEqual(decode("value", _encode({"a": 1})), {"a": 1})
        self.assertEqual(decode("value", _encode([1, "x", None])), [1, "x", None])
        # JSON null (omitted optional arg) decodes to None without raising.
        self.assertIsNone(decode("value", _encode(None)))

    def test_decode_rejects_bad_input_with_arg_name(self):
        decode = self.ns["decode_template_arg"]
        ArgDecodeError = self.ns["ArgDecodeError"]
        for bad in (None, "", "   ", "!!!not-base64!!!", _encode("ok")[:-2] + "##"):
            with self.assertRaises(ArgDecodeError) as ctx:
                decode("myArg", bad)
            self.assertEqual(ctx.exception.arg_name, "myArg")
        # Valid base64 but not JSON must also fail loudly at the seam.
        with self.assertRaises(ArgDecodeError):
            decode(
                "myArg",
                base64.b64encode(b"plain text, not json").decode("ascii"),
            )

    def test_lenient_decoder_maps_failure_to_none(self):
        lenient = self.ns["decode_template_json"]
        self.assertEqual(lenient(_encode({"ok": True})), {"ok": True})
        self.assertIsNone(lenient(None))
        self.assertIsNone(lenient("garbage"))

    def test_failure_payload_contract(self):
        failure = self.ns["arg_decode_failure"]
        self.assertEqual(
            failure("myArg"),
            {"success": False, "error": "arg_decode_failed", "arg": "myArg"},
        )

    def test_unreal_text_unicode_safety(self):
        # Regression: str() on py2 ascii-encoded unicode names (live case:
        # U+041C inside an asset name broke manage_editor.project_info).
        # unreal_text must preserve non-ascii text on both runtimes.
        text = self.ns["unreal_text"]
        self.assertEqual(text(None), "")
        self.assertEqual(text("Мета"), "Мета")
        self.assertEqual(text("Мета".encode("utf-8")), "Мета")
        self.assertEqual(text(42), "42")


if __name__ == "__main__":
    unittest.main()
