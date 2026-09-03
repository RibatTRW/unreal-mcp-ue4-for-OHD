def set_mesh_material_color(args):
    color = args.get("color") or [1.0, 1.0, 1.0, 1.0]
    parameter_name = args.get("parameter_name")
    slot_index = int(args.get("slot_index", 0))
    material_path = args.get("material_path")
    material_interface = None

    try:
        if args.get("actor_name"):
            actor, component = _resolve_actor_and_component(args)
            if material_path:
                apply_material_to_component(component, material_path, slot_index)
            material_interface = component.get_material(slot_index)
            tinted_material, used_parameter = tint_material_interface(
                material_interface,
                color,
                parameter_name=parameter_name,
                instance_name=args.get("instance_name"),
                package_path=args.get("instance_path") or "/Game/MCP/GeneratedMaterials",
            )
            component.set_material(slot_index, tinted_material)
            return {
                "success": True,
                "actor": get_actor_summary(actor),
                "component": get_object_name(component),
                "slot_index": slot_index,
                "material": get_material_summary(tinted_material),
                "parameter_name": used_parameter,
            }

        if args.get("blueprint_name"):
            blueprint, component_node, component_template = _get_blueprint_component(
                args.get("blueprint_name"),
                args.get("component_name"),
            )
            if material_path:
                apply_material_to_component(component_template, material_path, slot_index)
            material_interface = component_template.get_material(slot_index)
            tinted_material, used_parameter = tint_material_interface(
                material_interface,
                color,
                parameter_name=parameter_name,
                instance_name=args.get("instance_name"),
                package_path=args.get("instance_path") or "/Game/MCP/GeneratedMaterials",
            )
            component_template.set_material(slot_index, tinted_material)
            finalize_blueprint_change(blueprint, structural=False)
            return {
                "success": True,
                "blueprint": get_asset_package_name(blueprint),
                "component": get_scs_node_name(component_node),
                "slot_index": slot_index,
                "material": get_material_summary(tinted_material),
                "parameter_name": used_parameter,
            }

        if material_path:
            material_interface = load_material_asset(material_path)
            tinted_material, used_parameter = tint_material_interface(
                material_interface,
                color,
                parameter_name=parameter_name,
                instance_name=args.get("instance_name"),
                package_path=args.get("instance_path") or "/Game/MCP/GeneratedMaterials",
            )
            return {
                "success": True,
                "material": get_material_summary(tinted_material),
                "parameter_name": used_parameter,
            }
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    return {
        "success": False,
        "message": "Provide actor_name, blueprint_name, or material_path for material color changes.",
    }
