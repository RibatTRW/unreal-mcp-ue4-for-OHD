def get_actor_mesh_components(actor):
    if not actor:
        return []

    component_classes = [
        getattr(unreal, "StaticMeshComponent", None),
        getattr(unreal, "SkeletalMeshComponent", None),
        getattr(unreal, "InstancedStaticMeshComponent", None),
        getattr(unreal, "HierarchicalInstancedStaticMeshComponent", None),
        getattr(unreal, "MeshComponent", None),
    ]

    components = []
    seen_names = set()
    for component_class in component_classes:
        if not component_class:
            continue

        try:
            class_components = list(actor.get_components_by_class(component_class) or [])
        except Exception:
            class_components = []

        for component in class_components:
            component_name = get_object_name(component)
            if component_name in seen_names:
                continue
            seen_names.add(component_name)
            components.append(component)

    try:
        generic_components = list(
            actor.get_components_by_class(getattr(unreal, "ActorComponent", object)) or []
        )
    except Exception:
        generic_components = []

    for component in generic_components:
        component_name = get_object_name(component)
        if component_name in seen_names:
            continue

        if not hasattr(component, "set_material"):
            continue

        if not (
            hasattr(component, "get_material")
            or hasattr(component, "get_num_materials")
            or hasattr(component, "get_material_slot_names")
        ):
            continue

        seen_names.add(component_name)
        components.append(component)

    return components


def get_material_summary(material_interface):
    if not material_interface:
        return {}

    return {
        "name": get_object_name(material_interface),
        "class": get_object_class_name(material_interface),
        "path": get_asset_package_name(material_interface)
        or get_asset_object_path(material_interface),
    }


def get_component_material_info(component):
    material_info = []

    material_slot_names = []
    try:
        if hasattr(component, "get_material_slot_names"):
            material_slot_names = list(component.get_material_slot_names() or [])
    except Exception:
        material_slot_names = []

    try:
        material_count = int(component.get_num_materials())
    except Exception:
        material_count = len(material_slot_names)

    if material_count <= 0:
        material_count = len(material_slot_names)

    for slot_index in range(max(material_count, 0)):
        material_interface = None
        try:
            material_interface = component.get_material(slot_index)
        except Exception:
            material_interface = None

        slot_name = ""
        if slot_index < len(material_slot_names):
            slot_name = unreal_text(material_slot_names[slot_index])

        material_info.append(
            {
                "slot_index": slot_index,
                "slot_name": slot_name,
                "material": get_material_summary(material_interface),
            }
        )

    return material_info


def find_actor_material_component(actor, component_name=None):
    mesh_components = get_actor_mesh_components(actor)
    if component_name:
        for component in mesh_components:
            if get_object_name(component) == component_name:
                return component
        raise ValueError(
            "Material-capable component not found on actor: {0}".format(component_name)
        )

    if not mesh_components:
        raise ValueError(
            "Actor '{0}' does not have a material-capable mesh component.".format(
                actor.get_actor_label()
            )
        )

    return mesh_components[0]


def get_actor_material_report(actor):
    return {
        "actor": get_actor_summary(actor),
        "components": [
            {
                "name": get_object_name(component),
                "class": get_object_class_name(component),
                "materials": get_component_material_info(component),
            }
            for component in get_actor_mesh_components(actor)
        ],
    }
