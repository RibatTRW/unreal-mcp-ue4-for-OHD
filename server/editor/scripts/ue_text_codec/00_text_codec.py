import base64
import io
import json
import os
import re
import tempfile

import unreal


try:
    _text_type = unicode
except NameError:
    _text_type = str


try:
    _string_types = basestring
except NameError:
    _string_types = str


def unreal_text(value):
    """Coerce an Unreal-exposed value to text without ascii-only str().

    On Python 2, str() on a unicode value encodes with ascii and raises
    UnicodeEncodeError for names outside ascii (seen live: U+041C inside
    an asset name broke manage_editor.project_info). Returning unicode on
    py2 keeps every downstream op safe; json.dumps with ensure_ascii
    escapes non-ascii on print, so the wire payload stays ascii.
    """
    if value is None:
        return _text_type()
    if isinstance(value, _text_type):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            try:
                return value.decode("utf-8", "ignore")
            except Exception:
                return _text_type()
    try:
        return _text_type(value)
    except Exception:
        pass
    try:
        return str(value).decode("utf-8", "ignore")
    except Exception:
        return _text_type()


def decode_template_json(encoded_value):
    """Lenient decoder kept for the existing call sites: strict decode with
    any failure (including omitted/empty input) mapped back to None."""
    try:
        return decode_template_arg("value", encoded_value)
    except ArgDecodeError:
        return None


class ArgDecodeError(Exception):
    def __init__(self, name):
        Exception.__init__(self, name)
        self.arg_name = name


def decode_template_arg(name, encoded_value):
    """Strict single-path decoder for jsonArg (base64 of JSON) payloads.

    Returns the decoded value (None only for a JSON null, i.e. an omitted
    optional argument). Raises ArgDecodeError carrying the argument name on
    any malformed input, so a broken render fails loudly at the seam instead
    of surfacing later as confusing behavior downstream.
    """
    if encoded_value is None:
        raise ArgDecodeError(name)

    encoded_text = unreal_text(encoded_value).strip()
    if not encoded_text:
        raise ArgDecodeError(name)

    try:
        decoded_text = base64.b64decode(encoded_text).decode("utf-8")
        return json.loads(decoded_text)
    except Exception:
        raise ArgDecodeError(name)


def arg_decode_failure(name):
    """Structured payload for a failed argument decode (decode_template_arg).

    The single contract for render failures: {"success": False,
    "error": "arg_decode_failed", "arg": <name>}.
    """
    return {"success": False, "error": "arg_decode_failed", "arg": unreal_text(name)}
