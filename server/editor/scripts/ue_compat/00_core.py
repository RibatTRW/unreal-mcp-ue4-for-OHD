import base64
import io
import json
import os
import re
import tempfile

import unreal


def _has_unreal_class(class_name):
    return hasattr(unreal, class_name)


try:
    _text_type = unicode
except NameError:
    _text_type = str


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
    if encoded_value is None:
        return None

    encoded_text = str(encoded_value).strip()
    if not encoded_text:
        return None

    try:
        decoded_text = base64.b64decode(encoded_text).decode("utf-8")
        return json.loads(decoded_text)
    except Exception:
        return None
