def _no_provider_result(payload, operation_name, reason):
    payload["success"] = False
    payload["unavailable"] = "source_control_no_provider"
    payload["message"] = (
        "Source control provider is not enabled in this editor session; "
        "{0} was not attempted ({1}).".format(operation_name, reason)
    )
    return payload


def _require_provider(payload, operation_name):
    """Resolve the helper and snapshot the provider, or return a
    no-provider result. Returns (helper, None) when a provider is enabled,
    or (None, result) with the defined unavailable shape otherwise."""
    try:
        helper, helper_name = _resolve_source_control_helper()
    except Exception as exc:
        payload["helper_class"] = ""
        return None, _no_provider_result(payload, operation_name, unreal_text(exc))

    payload["helper_class"] = helper_name
    try:
        payload.update(_provider_snapshot(helper))
    except Exception as exc:
        return None, _no_provider_result(payload, operation_name, unreal_text(exc))

    if not payload.get("enabled"):
        return None, _no_provider_result(
            payload, operation_name, "provider reports enabled=False"
        )

    return helper, None


def _run_file_operation(
    operation_name,
    method_names,
    single_key=None,
    multi_key=None,
    description_key=None,
    keep_checked_out_key=None,
):
    def _handler(args):
        payload = {
            "operation": operation_name,
        }
        helper, unavailable = _require_provider(payload, operation_name)
        if unavailable is not None:
            return unavailable

        call_args = []

        if single_key:
            file_value = unreal_text(args.get(single_key) or "").strip()
            if not file_value:
                return {"success": False, "message": "{0} is required".format(single_key)}
            payload["file"] = file_value
            call_args.append(file_value)

        if multi_key:
            files = _coerce_string_list(args.get(multi_key), multi_key)
            payload[multi_key] = files
            payload["count"] = len(files)
            call_args.append(files)

        if description_key:
            description = unreal_text(args.get(description_key) or "").strip()
            if not description:
                return {
                    "success": False,
                    "message": "{0} is required".format(description_key),
                }
            payload["description"] = description
            call_args.append(description)

        call_args.append(True)

        if keep_checked_out_key:
            keep_checked_out = bool(args.get(keep_checked_out_key, False))
            payload["keep_checked_out"] = keep_checked_out
            call_args.append(keep_checked_out)

        try:
            success = bool(_call_helper_method(helper, method_names, *call_args))
        except TypeError as exc:
            if not keep_checked_out_key or not call_args:
                raise

            message = unreal_text(exc)
            if "argument" not in message and "positional" not in message:
                raise

            success = bool(_call_helper_method(helper, method_names, *call_args[:-1]))
            payload["keep_checked_out_ignored"] = True
        payload["success"] = success
        if not success and "message" not in payload:
            payload["message"] = "{0} failed".format(operation_name)
        return _append_last_error(payload, helper)

    return _handler


def _revert_and_reload_packages(args):
    payload = {
        "operation": "revert_and_reload_packages",
    }
    helper, unavailable = _require_provider(payload, "revert_and_reload_packages")
    if unavailable is not None:
        return unavailable

    packages = _coerce_string_list(args.get("packages"), "packages")
    payload["packages"] = packages
    payload["count"] = len(packages)
    payload["revert_all"] = bool(args.get("revert_all", False))
    payload["reload_world"] = bool(args.get("reload_world", False))

    success = bool(
        _call_helper_method(
            helper,
            ("revert_and_reload_packages", "RevertAndReloadPackages"),
            packages,
            payload["revert_all"],
            payload["reload_world"],
        )
    )
    payload["success"] = success
    if not success:
        payload["message"] = "revert_and_reload_packages failed"
    return _append_last_error(payload, helper)
