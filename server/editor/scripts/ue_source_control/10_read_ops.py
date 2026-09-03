def _provider_info(args):
    helper, helper_name = _resolve_source_control_helper()
    payload = {
        "success": True,
        "helper_class": helper_name,
    }
    payload.update(_provider_snapshot(helper))
    return _append_last_error(payload, helper)


def _query_state(args):
    file_value = unreal_text(args.get("file") or "").strip()
    if not file_value:
        return {"success": False, "message": "file is required"}

    helper, helper_name = _resolve_source_control_helper()
    payload = {
        "success": True,
        "file": file_value,
        "helper_class": helper_name,
    }
    payload.update(_provider_snapshot(helper))
    state = _call_helper_method(
        helper,
        ("query_file_state", "QueryFileState"),
        file_value,
        True,
    )
    payload["state"] = _serialize_source_control_state(state)
    return _append_last_error(payload, helper)


def _query_states(args):
    files = _coerce_string_list(args.get("files"), "files")
    helper, helper_name = _resolve_source_control_helper()
    payload = {
        "success": True,
        "files": files,
        "count": len(files),
        "helper_class": helper_name,
    }
    payload.update(_provider_snapshot(helper))
    try:
        states = _call_helper_method(
            helper,
            ("query_file_states", "QueryFileStates"),
            files,
            True,
        )
    except RuntimeError as exc:
        if "does not expose query_file_states" not in unreal_text(exc):
            raise

        states = [
            _call_helper_method(
                helper,
                ("query_file_state", "QueryFileState"),
                file_value,
                True,
            )
            for file_value in files
        ]
    payload["states"] = [
        _serialize_source_control_state(state) for state in (states or [])
    ]
    return _append_last_error(payload, helper)
