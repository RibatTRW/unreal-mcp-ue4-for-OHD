def iter_widget_tree_widgets(widget_tree):
    iterator_class = getattr(unreal, "ObjectIterator", None)
    if not iterator_class or not widget_tree:
        return []

    widgets = []
    try:
        iterator = iterator_class(unreal.Widget)
    except Exception:
        try:
            iterator = iterator_class()
        except Exception:
            return []

    for widget in iterator:
        try:
            if widget.get_outer() == widget_tree:
                widgets.append(widget)
        except Exception:
            continue

    widgets.sort(key=lambda item: get_widget_name(item))
    return widgets


def find_widget_in_tree(widget_tree, widget_name):
    if not widget_name:
        return None

    try:
        widget = widget_tree.find_widget(widget_name)
        if widget:
            return widget
    except Exception:
        pass

    for widget in iter_widget_tree_widgets(widget_tree):
        if get_widget_name(widget) == widget_name:
            return widget

    try:
        tree_path = widget_tree.get_path_name()
    except Exception:
        tree_path = ""

    if tree_path:
        try:
            widget = unreal.load_object(None, "{0}.{1}".format(tree_path, widget_name))
            if widget and object_is_instance_of(widget, unreal.Widget):
                return widget
        except Exception:
            pass

    root_widget = get_root_widget(widget_tree)
    if not root_widget:
        return None

    if get_widget_name(root_widget) == widget_name:
        return root_widget

    stack = list(get_panel_children(root_widget))
    while stack:
        current_widget = stack.pop()
        if get_widget_name(current_widget) == widget_name:
            return current_widget
        stack.extend(get_panel_children(current_widget))

    return None


def find_widget_parent(widget_tree, target_widget):
    try:
        direct_parent = target_widget.get_parent()
        if direct_parent:
            return direct_parent
    except Exception:
        pass

    root_widget = get_root_widget(widget_tree)
    if not root_widget or not target_widget or root_widget == target_widget:
        return None

    stack = [root_widget]
    while stack:
        current_widget = stack.pop()
        for child_widget in get_panel_children(current_widget):
            if child_widget == target_widget:
                return current_widget
            stack.append(child_widget)

    return None


def find_direct_child_widget(parent_widget, child_widget_name):
    for child_widget in get_panel_children(parent_widget):
        if get_widget_name(child_widget) == child_widget_name:
            return child_widget
    return None


def widget_contains_descendant(root_widget, candidate_descendant):
    if not root_widget or not candidate_descendant:
        return False

    stack = list(get_panel_children(root_widget))
    while stack:
        current_widget = stack.pop()
        if current_widget == candidate_descendant:
            return True
        stack.extend(get_panel_children(current_widget))

    return False


def get_widget_subtree(root_widget):
    if not root_widget:
        return []

    widgets = []
    stack = [root_widget]
    while stack:
        current_widget = stack.pop()
        widgets.append(current_widget)
        stack.extend(get_panel_children(current_widget))

    return widgets


def require_panel_widget(widget, widget_name=None):
    if is_panel_widget(widget):
        return widget

    raise ValueError(
        "Widget '{0}' is not a panel widget and cannot contain child widgets.".format(
            widget_name or get_widget_name(widget)
        )
    )
