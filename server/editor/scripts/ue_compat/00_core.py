import base64
import io
import json
import os
import re
import tempfile

import unreal


def _has_unreal_class(class_name):
    return hasattr(unreal, class_name)


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
