def _property_candidates(prop_name):
    raw_name = unreal_text(prop_name or "").strip()
    if not raw_name:
        return []

    candidates = []

    def _append(name):
        if name and name not in candidates:
            candidates.append(name)

    for candidate in get_property_name_candidates(raw_name):
        _append(candidate)

    if raw_name.startswith("b_"):
        for candidate in get_property_name_candidates(raw_name[2:]):
            _append(candidate)
    elif raw_name.startswith("b") and len(raw_name) > 1 and raw_name[1].isupper():
        for candidate in get_property_name_candidates(
            raw_name[1].lower() + raw_name[2:]
        ):
            _append(candidate)
    else:
        for candidate in get_property_name_candidates("b_" + raw_name):
            _append(candidate)

        for candidate in get_property_name_candidates(
            "b" + raw_name[:1].upper() + raw_name[1:]
        ):
            _append(candidate)

    return candidates


def _struct_property_value(target, prop_name, default=None):
    for candidate_name in _property_candidates(prop_name):
        try:
            if hasattr(target, "get_editor_property"):
                value = target.get_editor_property(candidate_name)
                if value is not None:
                    return value
        except Exception:
            pass

        try:
            value = getattr(target, candidate_name)
            if value is not None:
                return value
        except Exception:
            pass

    return default


def _serialize_source_control_state(state):
    if state is None:
        return None

    return {
        "filename": _text_to_string(_struct_property_value(state, "filename", "")),
        "is_valid": bool(_struct_property_value(state, "is_valid", False)),
        "is_unknown": bool(_struct_property_value(state, "is_unknown", False)),
        "can_check_in": bool(_struct_property_value(state, "can_check_in", False)),
        "can_check_out": bool(_struct_property_value(state, "can_check_out", False)),
        "is_checked_out": bool(_struct_property_value(state, "is_checked_out", False)),
        "is_current": bool(_struct_property_value(state, "is_current", False)),
        "is_source_controlled": bool(
            _struct_property_value(state, "is_source_controlled", False)
        ),
        "is_added": bool(_struct_property_value(state, "is_added", False)),
        "is_deleted": bool(_struct_property_value(state, "is_deleted", False)),
        "is_ignored": bool(_struct_property_value(state, "is_ignored", False)),
        "can_edit": bool(_struct_property_value(state, "can_edit", False)),
        "can_delete": bool(_struct_property_value(state, "can_delete", False)),
        "is_modified": bool(_struct_property_value(state, "is_modified", False)),
        "can_add": bool(_struct_property_value(state, "can_add", False)),
        "is_conflicted": bool(_struct_property_value(state, "is_conflicted", False)),
        "can_revert": bool(_struct_property_value(state, "can_revert", False)),
        "is_checked_out_other": bool(
            _struct_property_value(state, "is_checked_out_other", False)
        ),
        "checked_out_other": _text_to_string(
            _struct_property_value(state, "checked_out_other", "")
        ),
        "is_checked_out_in_other_branch": bool(
            _struct_property_value(state, "is_checked_out_in_other_branch", False)
        ),
        "is_modified_in_other_branch": bool(
            _struct_property_value(state, "is_modified_in_other_branch", False)
        ),
        "previous_user": _text_to_string(
            _struct_property_value(state, "previous_user", "")
        ),
    }
