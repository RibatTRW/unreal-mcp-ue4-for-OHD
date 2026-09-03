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
        normalized_path = unreal_text(candidate_path or "").strip()
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

    return widget_blueprint, widget_path or unreal_text(widget_name or ""), None


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
        existing_object_name = unreal_text(get_editor_property_value(existing_binding, "object_name", ""))
        existing_property_name = unreal_text(get_editor_property_value(existing_binding, "property_name", ""))
        if existing_object_name == object_name and existing_property_name == property_name:
            continue
        filtered_bindings.append(existing_binding)

    filtered_bindings.append(binding)
    set_object_property(widget_blueprint, "bindings", filtered_bindings)
    finalize_blueprint_change(widget_blueprint, structural=True)
