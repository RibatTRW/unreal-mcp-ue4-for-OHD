def add_text_block_to_widget(args):
    widget_name = args.get("widget_name")
    text_block_name = args.get("text_block_name")
    text_value = args.get("text", "")
    position = args.get("position") or [0.0, 0.0]
    size = args.get("size") or [200.0, 50.0]
    z_order = args.get("z_order")
    font_size = args.get("font_size")
    color_values = args.get("color")

    try:
        widget_blueprint = _load_widget_blueprint(widget_name)
        widget_tree, root_widget = _ensure_root_canvas(widget_blueprint)
        root_widget = require_panel_widget(root_widget, get_widget_name(root_widget))
        text_block = create_widget_instance(widget_tree, "TextBlock", text_block_name)
        slot = add_widget_to_tree(widget_tree, text_block, root_widget)
        if z_order is None:
            z_order = default_z_order_for_widget(text_block)
        set_canvas_panel_slot_layout(slot, position=position, size=size, z_order=z_order)
        set_widget_text(text_block, text_value)
        set_widget_font_size(text_block, font_size)
        _try_set_widget_color(text_block, color_values)
        save_widget_blueprint(widget_blueprint)
        return {
            "success": True,
            "widget_blueprint": get_asset_package_name(widget_blueprint),
            "widget": {
                "name": text_block_name,
                "class": "TextBlock",
                "text": text_value,
                "position": {"x": float(position[0]), "y": float(position[1])},
                "size": {"x": float(size[0]), "y": float(size[1])},
                "style": get_widget_style_report(text_block),
            },
        }
    except Exception as exc:
        return _format_widget_authoring_error(exc)


def add_button_to_widget(args):
    widget_name = args.get("widget_name")
    button_name = args.get("button_name")
    text_value = args.get("text", "")
    position = args.get("position") or [0.0, 0.0]
    size = args.get("size") or [200.0, 50.0]
    z_order = args.get("z_order")
    font_size = args.get("font_size")
    text_color = args.get("color")
    background_color = args.get("background_color")

    try:
        widget_blueprint = _load_widget_blueprint(widget_name)
        widget_tree, root_widget = _ensure_root_canvas(widget_blueprint)
        root_widget = require_panel_widget(root_widget, get_widget_name(root_widget))

        button_widget = create_widget_instance(widget_tree, "Button", button_name)
        button_slot = add_widget_to_tree(widget_tree, button_widget, root_widget)
        if z_order is None:
            z_order = default_z_order_for_widget(button_widget)
        set_canvas_panel_slot_layout(button_slot, position=position, size=size, z_order=z_order)
        _try_set_widget_background_color(button_widget, background_color)

        if text_value:
            text_block_name = "{0}_Text".format(button_name)
            text_block = create_widget_instance(widget_tree, "TextBlock", text_block_name)
            add_widget_to_tree(widget_tree, text_block, button_widget)
            set_widget_text(text_block, text_value)
            set_widget_font_size(text_block, font_size)
            _try_set_widget_color(text_block, text_color)

        save_widget_blueprint(widget_blueprint)
        return {
            "success": True,
            "widget_blueprint": get_asset_package_name(widget_blueprint),
            "widget": {
                "name": button_name,
                "class": "Button",
                "text": text_value,
                "position": {"x": float(position[0]), "y": float(position[1])},
                "size": {"x": float(size[0]), "y": float(size[1])},
                "style": get_widget_style_report(button_widget),
            },
        }
    except Exception as exc:
        return _format_widget_authoring_error(exc)
