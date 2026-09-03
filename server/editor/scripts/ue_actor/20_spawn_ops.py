def spawn_actor(args):
    actor_class_name = args.get("type")
    actor_name = args.get("name") or ""
    location = args.get("location") or [0.0, 0.0, 0.0]
    rotation = args.get("rotation") or [0.0, 0.0, 0.0]

    actor_class = resolve_actor_class(
        actor_class_name,
        {
            "StaticMeshActor": unreal.StaticMeshActor,
            "SkeletalMeshActor": unreal.SkeletalMeshActor,
            "DirectionalLight": unreal.DirectionalLight,
            "PointLight": unreal.PointLight,
            "SpotLight": unreal.SpotLight,
            "CameraActor": unreal.CameraActor,
            "PlayerStart": unreal.PlayerStart,
            "Character": unreal.Character,
            "Pawn": unreal.Pawn,
        },
    )
    if not actor_class:
        return {
            "success": False,
            "message": "Could not find actor class: {0}".format(actor_class_name),
        }

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        actor_class,
        _vector_from_list(location),
        _rotator_from_list(rotation),
    )
    if not actor:
        return {"success": False, "message": "Failed to spawn actor"}

    if actor_name:
        actor.set_actor_label(actor_name)

    return {"success": True, "actor": get_actor_summary(actor)}


def spawn_blueprint_actor(args):
    blueprint_name = args.get("blueprint_name")
    actor_name = args.get("name") or ""
    location = args.get("location") or [0.0, 0.0, 0.0]
    rotation = args.get("rotation") or [0.0, 0.0, 0.0]
    scale = args.get("scale")
    properties = args.get("properties") or {}

    try:
        blueprint = load_blueprint_asset(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    blueprint_path = get_asset_package_name(blueprint)
    blueprint_class = None

    try:
        blueprint_class = unreal.EditorAssetLibrary.load_blueprint_class(blueprint_path)
    except Exception:
        blueprint_class = get_blueprint_generated_class(blueprint)

    if not blueprint_class:
        return {
            "success": False,
            "message": "Could not resolve blueprint class for {0}".format(blueprint_name),
        }

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        blueprint_class,
        _vector_from_list(location),
        _rotator_from_list(rotation),
    )
    if not actor:
        return {
            "success": False,
            "message": "Failed to spawn blueprint actor from {0}".format(blueprint_name),
        }

    if actor_name:
        actor.set_actor_label(actor_name)

    if scale is not None:
        actor.set_actor_scale3d(_vector_from_list(scale, [1.0, 1.0, 1.0]))

    for property_name, property_value in properties.items():
        apply_actor_property(actor, property_name, property_value)

    return {
        "success": True,
        "blueprint": blueprint_path,
        "actor": get_actor_summary(actor),
    }
