def get_widget_tree(widget_blueprint):
    widget_tree = get_editor_property_value(widget_blueprint, "widget_tree")
    if widget_tree:
        return widget_tree

    asset_path = get_asset_package_name(widget_blueprint)
    asset_name = str(asset_path or "").rsplit("/", 1)[-1]
    if asset_path and asset_name:
        for tree_path in (
            "{0}.{1}:WidgetTree".format(asset_path, asset_name),
            "{0}.{1}_C:WidgetTree".format(asset_path, asset_name),
        ):
            try:
                widget_tree = unreal.load_object(None, tree_path)
                if widget_tree and get_object_class_name(widget_tree) == "WidgetTree":
                    return widget_tree
            except Exception:
                continue

    raise ValueError(
        "Widget blueprint does not expose an editable widget tree in UE4.25 Python."
    )


def get_root_widget(widget_tree):
    root_widget = get_editor_property_value(widget_tree, "root_widget")
    if root_widget:
        return root_widget

    root_candidates = []
    for widget in iter_widget_tree_widgets(widget_tree):
        try:
            if widget.get_parent():
                continue
        except Exception:
            pass

        score = 0
        widget_name = get_widget_name(widget)
        child_count = 0

        if is_panel_widget(widget):
            score += 100
        if object_is_instance_of(widget, unreal.CanvasPanel):
            score += 50
        if object_is_instance_of(widget, unreal.Widget):
            score += 10

        try:
            if hasattr(widget, "get_children_count"):
                child_count = int(widget.get_children_count())
        except Exception:
            pass

        score += min(child_count, 25)

        if widget_name == "CanvasPanel_0":
            score += 2
        elif widget_name.lower().startswith("canvaspanel"):
            score += 1

        root_candidates.append((score, widget_name, widget))

    if root_candidates:
        root_candidates.sort(key=lambda item: (-item[0], item[1]))
        return root_candidates[0][2]

    try:
        tree_path = widget_tree.get_path_name()
    except Exception:
        tree_path = ""

    if tree_path:
        for candidate_name in (
            "CanvasPanel_0",
            "RootCanvas",
            "Overlay_0",
            "SizeBox_0",
            "Border_0",
        ):
            try:
                candidate_widget = unreal.load_object(
                    None, "{0}.{1}".format(tree_path, candidate_name)
                )
                if candidate_widget and object_is_instance_of(
                    candidate_widget, unreal.Widget
                ):
                    return candidate_widget
            except Exception:
                continue

    return None


def is_panel_widget(widget):
    if not widget:
        return False

    try:
        return object_is_instance_of(widget, unreal.PanelWidget)
    except Exception:
        return False


def get_panel_children(widget):
    if not is_panel_widget(widget):
        return []

    try:
        return list(widget.get_all_children())
    except Exception:
        return []
