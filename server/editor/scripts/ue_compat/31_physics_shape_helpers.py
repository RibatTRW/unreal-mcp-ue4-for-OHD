def apply_physics_to_component_instance(component, args):
    if component is None:
        raise ValueError("A primitive component is required")

    simulate_physics = bool(args.get("simulate_physics", True))
    gravity_enabled = bool(args.get("gravity_enabled", True))
    mass = float(args.get("mass", 1.0))
    linear_damping = float(args.get("linear_damping", 0.01))
    angular_damping = float(args.get("angular_damping", 0.0))

    simulate_setter = getattr(component, "set_simulate_physics", None)
    if callable(simulate_setter):
        simulate_setter(simulate_physics)

    gravity_setter = getattr(component, "set_enable_gravity", None)
    if callable(gravity_setter):
        gravity_setter(gravity_enabled)

    if hasattr(component, "set_mass_override_in_kg"):
        bone_name = unreal.Name("") if hasattr(unreal, "Name") else ""
        try:
            component.set_mass_override_in_kg(bone_name, mass, True)
        except Exception:
            pass

    set_object_property(component, "linear_damping", linear_damping)
    set_object_property(component, "angular_damping", angular_damping)

    return {
        "component_name": get_object_name(component),
        "component_class": get_object_class_name(component),
        "simulate_physics": simulate_physics,
        "gravity_enabled": gravity_enabled,
        "mass": mass,
        "linear_damping": linear_damping,
        "angular_damping": angular_damping,
    }


_BASIC_SHAPE_ASSET_PATHS = {
    "cube": "/Engine/BasicShapes/Cube.Cube",
    "sphere": "/Engine/BasicShapes/Sphere.Sphere",
    "cylinder": "/Engine/BasicShapes/Cylinder.Cylinder",
    "cone": "/Engine/BasicShapes/Cone.Cone",
    "plane": "/Engine/BasicShapes/Plane.Plane",
}


def load_basic_shape_mesh(shape_name="cube"):
    mesh_path = _BASIC_SHAPE_ASSET_PATHS.get(unreal_text(shape_name or "cube").lower())
    if not mesh_path:
        raise ValueError("Unsupported basic shape: {0}".format(shape_name))

    shape_mesh = unreal.EditorAssetLibrary.load_asset(mesh_path)
    if not shape_mesh:
        raise ValueError("Could not load engine basic shape mesh: {0}".format(mesh_path))

    return shape_mesh


def spawn_basic_shape_actor(
    label,
    location,
    scale=None,
    rotation=None,
    shape_name="cube",
    material_identifier=None,
):
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.StaticMeshActor,
        as_vector3(location),
        as_rotator(rotation),
    )
    if not actor:
        raise RuntimeError("Failed to spawn StaticMeshActor for '{0}'".format(label))

    actor.set_actor_label(label)
    mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
    if mesh_component is None:
        raise RuntimeError(
            "Spawned actor '{0}' does not expose a StaticMeshComponent.".format(label)
        )

    mesh_component.set_static_mesh(load_basic_shape_mesh(shape_name))
    if scale is not None:
        actor.set_actor_scale3d(as_vector3(scale, [1.0, 1.0, 1.0]))

    if material_identifier:
        apply_material_to_component(mesh_component, material_identifier)

    return actor
