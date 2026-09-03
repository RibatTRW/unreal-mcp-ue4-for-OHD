def get_actor_summary(actor):
    actor_summary = {
        "name": actor.get_name(),
        "label": actor.get_actor_label(),
        "class": actor.get_class().get_name(),
        "location": {
            "x": actor.get_actor_location().x,
            "y": actor.get_actor_location().y,
            "z": actor.get_actor_location().z,
        },
        "rotation": {
            "pitch": actor.get_actor_rotation().pitch,
            "yaw": actor.get_actor_rotation().yaw,
            "roll": actor.get_actor_rotation().roll,
        },
        "scale": {
            "x": actor.get_actor_scale3d().x,
            "y": actor.get_actor_scale3d().y,
            "z": actor.get_actor_scale3d().z,
        },
        "hidden_in_editor": bool(actor.is_hidden_ed()),
    }

    try:
        actor_summary["folder_path"] = unreal_text(actor.get_folder_path())
    except Exception:
        actor_summary["folder_path"] = ""

    try:
        actor_summary["tags"] = [unreal_text(tag) for tag in list(actor.tags)]
    except Exception:
        actor_summary["tags"] = []

    component_summaries = []
    try:
        for component in list(actor.get_components_by_class(unreal.ActorComponent) or [])[:16]:
            component_summaries.append(
                {
                    "name": get_object_name(component),
                    "class": get_object_class_name(component),
                }
            )
    except Exception:
        pass

    actor_summary["components"] = component_summaries
    return actor_summary


def get_actor_property_report(actor):
    actor_report = get_actor_summary(actor)
    common_properties = {}

    for property_name in (
        "mobility",
        "actor_label",
        "can_be_damaged",
        "tick_group",
        "custom_time_dilation",
        "hidden",
        "b_hidden",
    ):
        property_value = get_editor_property_value(actor, property_name)
        if property_value is None:
            continue

        if isinstance(property_value, (_string_types, int, float, bool)):
            common_properties[property_name] = property_value
        else:
            common_properties[property_name] = unreal_text(property_value)

    actor_report["properties"] = common_properties
    return actor_report




def as_vector3(values, default=None):
    values = values or default or [0.0, 0.0, 0.0]
    if isinstance(values, dict):
        return unreal.Vector(
            x=float(values.get("x", 0.0)),
            y=float(values.get("y", 0.0)),
            z=float(values.get("z", 0.0)),
        )

    return unreal.Vector(
        x=float(values[0]),
        y=float(values[1]),
        z=float(values[2]),
    )


def as_rotator(values, default=None):
    values = values or default or [0.0, 0.0, 0.0]
    if isinstance(values, dict):
        return unreal.Rotator(
            pitch=float(values.get("pitch", 0.0)),
            yaw=float(values.get("yaw", 0.0)),
            roll=float(values.get("roll", 0.0)),
        )

    return unreal.Rotator(
        pitch=float(values[0]),
        yaw=float(values[1]),
        roll=float(values[2]),
    )


def as_linear_color(values, default=None):
    values = values or default or [1.0, 1.0, 1.0, 1.0]
    if isinstance(values, dict):
        return unreal.LinearColor(
            r=float(values.get("r", 1.0)),
            g=float(values.get("g", 1.0)),
            b=float(values.get("b", 1.0)),
            a=float(values.get("a", 1.0)),
        )

    return unreal.LinearColor(
        r=float(values[0]),
        g=float(values[1]),
        b=float(values[2]),
        a=float(values[3] if len(values) > 3 else 1.0),
    )


def as_slate_color(values, default=None):
    linear_color = as_linear_color(values, default=default)
    try:
        return unreal.SlateColor(
            specified_color=linear_color,
            color_use_rule=unreal.SlateColorStylingMode.USE_COLOR_SPECIFIED,
        )
    except Exception:
        pass

    try:
        slate_color = unreal.SlateColor()
        set_object_property(slate_color, "specified_color", linear_color)
        set_object_property(
            slate_color,
            "color_use_rule",
            unreal.SlateColorStylingMode.USE_COLOR_SPECIFIED,
        )
        return slate_color
    except Exception:
        return None


def linear_color_to_record(color_value):
    if color_value is None:
        return None

    try:
        specified_color = get_editor_property_value(color_value, "specified_color")
        if specified_color is not None:
            color_value = specified_color
    except Exception:
        pass

    result = {}
    for source_name, target_name in (
        ("r", "r"),
        ("g", "g"),
        ("b", "b"),
        ("a", "a"),
        ("R", "r"),
        ("G", "g"),
        ("B", "b"),
        ("A", "a"),
    ):
        if target_name in result:
            continue
        try:
            result[target_name] = float(getattr(color_value, source_name))
        except Exception:
            pass

    return result if result else None




def sanitize_asset_name(name, fallback="GeneratedAsset"):
    sanitized = re.sub(r"[^A-Za-z0-9_]+", "_", unreal_text(name or "")).strip("_")
    return sanitized or fallback
