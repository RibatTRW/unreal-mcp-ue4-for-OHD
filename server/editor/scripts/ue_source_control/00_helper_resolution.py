def _helper_exposes_method(helper, method_names):
    for method_name in method_names:
        try:
            if callable(getattr(helper, method_name, None)):
                return True
        except Exception:
            continue

    return False


def _resolve_source_control_helper():
    for class_name in ("SourceControlHelpers", "SourceControl"):
        try:
            helper = getattr(unreal, class_name, None)
            if helper and _helper_exposes_method(
                helper, ("current_provider", "CurrentProvider")
            ):
                return helper, class_name
        except Exception:
            pass

        try:
            helper = unreal.load_class(None, "/Script/SourceControl.{0}".format(class_name))
            if helper and _helper_exposes_method(
                helper, ("current_provider", "CurrentProvider")
            ):
                return helper, class_name
        except Exception:
            continue

    raise RuntimeError(
        "SourceControlHelpers is not exposed in this UE4.25 Python environment."
    )


def _call_helper_method(helper, method_names, *args):
    last_error = None
    method_found = False

    for method_name in method_names:
        try:
            method = getattr(helper, method_name, None)
            if callable(method):
                method_found = True
                return method(*args)
        except Exception as exc:
            last_error = exc
            continue

    if last_error is not None:
        raise last_error

    if method_found:
        raise RuntimeError(
            "Source control helper could not execute {0}".format(method_names[0])
        )

    raise RuntimeError(
        "Source control helper does not expose {0}".format(method_names[0])
    )


def _text_to_string(value):
    if value is None:
        return ""

    try:
        if hasattr(value, "to_string"):
            return str(value.to_string())
    except Exception:
        pass

    return str(value)


def _provider_snapshot(helper):
    return {
        "provider": _text_to_string(
            _call_helper_method(helper, ("current_provider", "CurrentProvider"))
        ),
        "enabled": bool(
            _call_helper_method(helper, ("is_enabled", "IsEnabled"))
        ),
        "available": bool(
            _call_helper_method(helper, ("is_available", "IsAvailable"))
        ),
    }


def _last_error(helper):
    try:
        last_error = _call_helper_method(helper, ("last_error_msg", "LastErrorMsg"))
    except Exception:
        return ""

    return _text_to_string(last_error).strip()


def _append_last_error(payload, helper):
    last_error = _last_error(helper)
    if last_error:
        payload["last_error"] = last_error
    return payload


def _coerce_string_list(values, label):
    if values is None:
        raise ValueError("{0} is required".format(label))

    if not isinstance(values, (list, tuple)):
        raise ValueError("{0} must be a list of strings".format(label))

    normalized_values = []
    for value in values:
        normalized_value = str(value or "").strip()
        if normalized_value:
            normalized_values.append(normalized_value)

    if not normalized_values:
        raise ValueError("{0} is required".format(label))

    return normalized_values
