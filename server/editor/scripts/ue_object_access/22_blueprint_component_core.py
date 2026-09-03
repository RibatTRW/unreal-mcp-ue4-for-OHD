def apply_scene_component_transform(
    component, location=None, rotation=None, scale=None
):
    if component is None:
        return

    if location is not None:
        relative_location = unreal.Vector(
            x=float(location[0] if isinstance(location, list) else location.get("x", 0.0)),
            y=float(location[1] if isinstance(location, list) else location.get("y", 0.0)),
            z=float(location[2] if isinstance(location, list) else location.get("z", 0.0)),
        )

        try:
            component.set_relative_location(relative_location, False, None, False)
        except Exception:
            try:
                component.set_relative_location(relative_location)
            except Exception:
                set_object_property(component, "relative_location", relative_location)

    if rotation is not None:
        relative_rotation = unreal.Rotator(
            pitch=float(rotation[0] if isinstance(rotation, list) else rotation.get("pitch", 0.0)),
            yaw=float(rotation[1] if isinstance(rotation, list) else rotation.get("yaw", 0.0)),
            roll=float(rotation[2] if isinstance(rotation, list) else rotation.get("roll", 0.0)),
        )

        try:
            component.set_relative_rotation(relative_rotation, False, None, False)
        except Exception:
            try:
                component.set_relative_rotation(relative_rotation)
            except Exception:
                set_object_property(component, "relative_rotation", relative_rotation)

    if scale is not None:
        relative_scale = unreal.Vector(
            x=float(scale[0] if isinstance(scale, list) else scale.get("x", 1.0)),
            y=float(scale[1] if isinstance(scale, list) else scale.get("y", 1.0)),
            z=float(scale[2] if isinstance(scale, list) else scale.get("z", 1.0)),
        )

        try:
            component.set_relative_scale3d(relative_scale)
        except Exception:
            set_object_property(component, "relative_scale3d", relative_scale)


def resolve_component_class(component_type):
    component_class = resolve_class_reference(
        component_type,
        ["Engine", "UMG", "Paper2D", "Niagara", "AIModule"],
    )
    if component_class:
        return component_class

    return resolve_actor_class(component_type)
