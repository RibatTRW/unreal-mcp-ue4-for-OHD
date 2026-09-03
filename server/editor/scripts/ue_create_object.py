import json


def create_object(
    object_class,
    object_name,
    location=None,
    rotation=None,
    scale=None,
    properties=None,
):
    try:
        world = get_editor_world()
        if not world:
            return {"error": "No world loaded"}

        actor_class = resolve_actor_class(
            object_class,
            {
                "StaticMeshActor": unreal.StaticMeshActor,
                "SkeletalMeshActor": unreal.SkeletalMeshActor,
                "DirectionalLight": unreal.DirectionalLight,
                "PointLight": unreal.PointLight,
                "SpotLight": unreal.SpotLight,
                "Camera": unreal.CameraActor,
                "CameraActor": unreal.CameraActor,
                "Pawn": unreal.Pawn,
                "Character": unreal.Character,
                "PlayerStart": unreal.PlayerStart,
            },
        )

        if not actor_class:
            return {"error": "Could not find class: {0}".format(object_class)}

        spawn_location = unreal.Vector(
            x=location.get("x", 0.0) if location else 0.0,
            y=location.get("y", 0.0) if location else 0.0,
            z=location.get("z", 0.0) if location else 0.0,
        )

        spawn_rotation = unreal.Rotator(
            pitch=rotation.get("pitch", 0.0) if rotation else 0.0,
            yaw=rotation.get("yaw", 0.0) if rotation else 0.0,
            roll=rotation.get("roll", 0.0) if rotation else 0.0,
        )

        spawn_scale = unreal.Vector(
            x=scale.get("x", 1.0) if scale else 1.0,
            y=scale.get("y", 1.0) if scale else 1.0,
            z=scale.get("z", 1.0) if scale else 1.0,
        )

        actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
            actor_class, spawn_location, spawn_rotation
        )
        if not actor:
            return {"error": "Failed to spawn actor"}

        if object_name:
            actor.set_actor_label(object_name)

        actor.set_actor_scale3d(spawn_scale)

        if actor.get_class().get_name() == "StaticMeshActor" and not properties:
            mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
            if mesh_component:
                name_lower = object_name.lower()
                mesh_path = "/Engine/BasicShapes/Cube"

                if "sphere" in name_lower or "ball" in name_lower:
                    mesh_path = "/Engine/BasicShapes/Sphere"
                elif "cylinder" in name_lower:
                    mesh_path = "/Engine/BasicShapes/Cylinder"
                elif "cone" in name_lower:
                    mesh_path = "/Engine/BasicShapes/Cone"
                elif "plane" in name_lower:
                    mesh_path = "/Engine/BasicShapes/Plane"

                mesh = unreal.EditorAssetLibrary.load_asset(mesh_path)
                if mesh:
                    mesh_component.set_static_mesh(mesh)

                default_material = unreal.EditorAssetLibrary.load_asset(
                    "/Engine/BasicShapes/BasicShapeMaterial"
                )
                if default_material:
                    mesh_component.set_material(0, default_material)

        if properties:
            for prop_name, prop_value in properties.items():
                try:
                    apply_actor_property(actor, prop_name, prop_value)
                except Exception:
                    continue

        return {
            "success": True,
            "actor_name": actor.get_name(),
            "actor_label": actor.get_actor_label(),
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
        }
    except Exception as e:
        return {"error": "Failed to create object: {0}".format(str(e))}


def parse_value(value_str):
    import json as parse_json

    if value_str and value_str != "null" and value_str.strip():
        try:
            return parse_json.loads(value_str)
        except Exception:
            return None
    return None


def main():
    # These are template variables from the js side
    object_class = "${object_class}"
    object_name = "${object_name}"

    location_str = """${location}"""
    rotation_str = """${rotation}"""
    scale_str = """${scale}"""
    properties_str = """${properties}"""

    location = parse_value(location_str)
    rotation = parse_value(rotation_str)
    scale = parse_value(scale_str)
    properties = parse_value(properties_str)

    result = create_object(
        object_class=object_class,
        object_name=object_name,
        location=location,
        rotation=rotation,
        scale=scale,
        properties=properties,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
