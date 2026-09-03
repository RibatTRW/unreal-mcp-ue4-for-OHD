def spawn_physics_blueprint_actor(args):
    blueprint_name = args.get("blueprint_name")
    actor_name = args.get("name") or ""
    location = args.get("location") or [0.0, 0.0, 0.0]
    rotation = args.get("rotation") or [0.0, 0.0, 0.0]
    scale = args.get("scale")
    component_name = args.get("component_name")
    material_path = args.get("material_path")

    try:
        blueprint = load_blueprint_asset(blueprint_name)
        blueprint_path = get_asset_package_name(blueprint)
        blueprint_class = None
        try:
            blueprint_class = unreal.EditorAssetLibrary.load_blueprint_class(blueprint_path)
        except Exception:
            blueprint_class = get_blueprint_generated_class(blueprint)

        if not blueprint_class:
            raise ValueError(
                "Could not resolve blueprint class for {0}".format(blueprint_name)
            )

        actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
            blueprint_class,
            as_vector3(location),
            as_rotator(rotation),
        )
        if actor is None:
            raise RuntimeError(
                "Failed to spawn blueprint actor from {0}".format(blueprint_name)
            )

        if actor_name:
            actor.set_actor_label(actor_name)
        if scale is not None:
            actor.set_actor_scale3d(as_vector3(scale, [1.0, 1.0, 1.0]))

        component = find_actor_material_component(actor, component_name)
        physics_summary = apply_physics_to_component_instance(component, args)
        if material_path:
            apply_material_to_component(component, material_path, int(args.get("slot_index", 0)))

        return {
            "success": True,
            "blueprint": blueprint_path,
            "actor": get_actor_summary(actor),
            "physics": physics_summary,
            "materials": get_component_material_info(component),
        }
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}
