def _format_widget_authoring_error(exc):
    message = unreal_text(exc)
    if "editable widget tree in UE4.25 Python" in message:
        return {
            "success": False,
            "message": message,
            "unsupported_capability": "widget_tree_authoring",
        }

    return {"success": False, "message": message}


def _load_widget_blueprint(widget_name):
    widget_blueprint = load_blueprint_asset(widget_name, allow_widget=True)
    if not get_object_class_name(widget_blueprint).endswith("WidgetBlueprint"):
        raise ValueError("Expected a widget blueprint, but got: {0}".format(widget_name))
    return widget_blueprint


def _resolve_widget_runtime_class(widget_name):
    widget_blueprint = None
    widget_path = ""

    try:
        widget_blueprint = _load_widget_blueprint(widget_name)
        widget_path = get_asset_package_name(widget_blueprint)
    except Exception:
        widget_blueprint = None

    candidate_paths = []
    if widget_path:
        candidate_paths.append(widget_path)

    if isinstance(widget_name, _string_types) and widget_name.startswith("/"):
        candidate_paths.append(widget_name)

    try:
        for asset_candidate in find_asset_candidates(widget_name, ["WidgetBlueprint"]):
            package_name = asset_candidate.get("package_name")
            if package_name:
                candidate_paths.append(package_name)
    except Exception:
        pass

    resolved_paths = []
    seen_paths = set()
    for candidate_path in candidate_paths:
        normalized_path = str(candidate_path or "").strip()
        if not normalized_path or normalized_path in seen_paths:
            continue
        seen_paths.add(normalized_path)
        resolved_paths.append(normalized_path)

    for candidate_path in resolved_paths:
        try:
            widget_class = unreal.EditorAssetLibrary.load_blueprint_class(candidate_path)
            if widget_class:
                return widget_blueprint, candidate_path, widget_class
        except Exception:
            pass

        asset_name = candidate_path.rsplit("/", 1)[-1]
        if not asset_name:
            continue

        try:
            widget_class = unreal.load_class(
                None,
                "{0}.{1}_C".format(candidate_path, asset_name),
            )
            if widget_class:
                return widget_blueprint, candidate_path, widget_class
        except Exception:
            pass

    return widget_blueprint, widget_path or str(widget_name or ""), None


def _ensure_root_canvas(widget_blueprint):
    root_result = ensure_canvas_root(widget_blueprint, wrap_existing_root=True)
    return root_result["widget_tree"], root_result["root_widget"]


def ensure_canvas_root_for_widget(args):
    widget_name = args.get("widget_name")
    root_widget_name = args.get("root_widget_name")
    wrap_existing_root = args.get("wrap_existing_root")
    if wrap_existing_root is None:
        wrap_existing_root = True

    try:
        widget_blueprint = _load_widget_blueprint(widget_name)
        root_result = ensure_canvas_root(
            widget_blueprint,
            root_widget_name=root_widget_name,
            wrap_existing_root=bool(wrap_existing_root),
        )
        save_widget_blueprint(widget_blueprint)

        root_widget = root_result["root_widget"]
        previous_root_widget = root_result["previous_root_widget"]

        return {
            "success": True,
            "widget_blueprint": get_asset_package_name(widget_blueprint),
            "root_widget": {
                "name": get_widget_name(root_widget),
                "class": get_widget_class_name(root_widget),
            },
            "previous_root_widget": {
                "name": get_widget_name(previous_root_widget),
                "class": get_widget_class_name(previous_root_widget),
            }
            if previous_root_widget
            else None,
            "created": bool(root_result["created"]),
            "wrapped_existing_root": bool(root_result["wrapped_existing_root"]),
            "renamed_existing_root": bool(root_result.get("renamed_existing_root")),
            "wrapped_root_layout": get_widget_slot_layout(previous_root_widget)
            if root_result["wrapped_existing_root"]
            else None,
        }
    except Exception as exc:
        return _format_widget_authoring_error(exc)


def _get_widget_text_value(widget):
    for method_name in ("get_text", "get_accessible_text"):
        method = getattr(widget, method_name, None)
        if callable(method):
            try:
                text_value = method()
                if text_value is not None:
                    return str(text_value)
            except Exception:
                pass

    text_value = get_editor_property_value(widget, "text")
    if text_value is not None:
        return str(text_value)

    return None


def _describe_widget_tree_entry(widget_tree, widget):
    parent_widget = find_widget_parent(widget_tree, widget)
    children = get_panel_children(widget)
    entry = {
        "name": get_widget_name(widget),
        "class": get_widget_class_name(widget),
        "parent": get_widget_name(parent_widget) if parent_widget else None,
        "children": [get_widget_name(child_widget) for child_widget in children],
        "layout": get_widget_slot_layout(widget),
    }

    text_value = _get_widget_text_value(widget)
    if text_value is not None:
        entry["text"] = text_value

    style = get_widget_style_report(widget)
    if style:
        entry["style"] = style

    return entry


def inspect_widget_tree(args):
    widget_name = args.get("widget_name")

    try:
        widget_blueprint = _load_widget_blueprint(widget_name)
        widget_tree = get_widget_tree(widget_blueprint)
        root_widget = get_root_widget(widget_tree)

        widgets = []
        seen_widget_names = set()

        for widget in iter_widget_tree_widgets(widget_tree):
            widget_entry = _describe_widget_tree_entry(widget_tree, widget)
            widgets.append(widget_entry)
            seen_widget_names.add(widget_entry["name"])

        if root_widget and get_widget_name(root_widget) not in seen_widget_names:
            widgets.append(_describe_widget_tree_entry(widget_tree, root_widget))

        widgets.sort(key=lambda entry: entry["name"])

        return {
            "success": True,
            "widget_blueprint": get_asset_package_name(widget_blueprint),
            "root_widget": {
                "name": get_widget_name(root_widget),
                "class": get_widget_class_name(root_widget),
            }
            if root_widget
            else None,
            "widget_count": len(widgets),
            "widgets": widgets,
        }
    except Exception as exc:
        return _format_widget_authoring_error(exc)


def _try_set_widget_color(widget, color_values):
    return apply_widget_color(widget, color_values, role="foreground")


def _try_set_widget_background_color(widget, color_values):
    return apply_widget_color(widget, color_values, role="background")


def _apply_delegate_binding(widget_blueprint, object_name, property_name, function_name=None, source_property=None):
    binding_class = getattr(unreal, "DelegateEditorBinding", None)
    if not binding_class:
        raise ValueError(
            "DelegateEditorBinding is not exposed in this UE4.25 Python environment."
        )

    bindings = list(get_editor_property_value(widget_blueprint, "bindings", []) or [])
    binding = binding_class()
    set_object_property(binding, "object_name", object_name)
    set_object_property(binding, "property_name", property_name)

    if function_name:
        set_object_property(binding, "function_name", function_name)
    if source_property:
        set_object_property(binding, "source_property", source_property)

    filtered_bindings = []
    for existing_binding in bindings:
        existing_object_name = str(get_editor_property_value(existing_binding, "object_name", ""))
        existing_property_name = str(get_editor_property_value(existing_binding, "property_name", ""))
        if existing_object_name == object_name and existing_property_name == property_name:
            continue
        filtered_bindings.append(existing_binding)

    filtered_bindings.append(binding)
    set_object_property(widget_blueprint, "bindings", filtered_bindings)
    finalize_blueprint_change(widget_blueprint, structural=True)
