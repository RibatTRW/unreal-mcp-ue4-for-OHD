def resolve_actor_class(object_class, class_mappings=None):
    if class_mappings and object_class in class_mappings:
        return class_mappings[object_class]

    try:
        return unreal.load_class(None, object_class)
    except Exception:
        pass

    try:
        if hasattr(unreal, "find_class"):
            return unreal.find_class(object_class)
    except Exception:
        pass

    try:
        return unreal.EditorAssetLibrary.load_blueprint_class(object_class)
    except Exception:
        pass

    return None


def get_property_name_candidates(prop_name):
    normalized_name = unreal_text(prop_name or "").strip()
    if not normalized_name:
        return []

    candidates = [normalized_name]
    if "_" in normalized_name:
        parts = [part for part in normalized_name.split("_") if part]
        if parts:
            pascal_case_name = "".join(part[:1].upper() + part[1:] for part in parts)
            camel_case_name = parts[0] + "".join(
                part[:1].upper() + part[1:] for part in parts[1:]
            )
            for candidate_name in (pascal_case_name, camel_case_name):
                if candidate_name and candidate_name not in candidates:
                    candidates.append(candidate_name)

    return candidates


def set_object_property(target, prop_name, prop_value):
    for candidate_name in get_property_name_candidates(prop_name):
        try:
            if hasattr(target, "set_editor_property"):
                target.set_editor_property(candidate_name, prop_value)
                return True
        except Exception:
            pass

        try:
            if hasattr(target, candidate_name):
                setattr(target, candidate_name, prop_value)
                return True
        except Exception:
            pass

    return False


def apply_actor_property(actor, prop_name, prop_value):
    try:
        actor_class_name = actor.get_class().get_name()
    except Exception:
        actor_class_name = ""

    try:
        if prop_name == "StaticMesh" and actor_class_name == "StaticMeshActor":
            static_mesh = unreal.EditorAssetLibrary.load_asset(prop_value)
            if static_mesh:
                mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
                if mesh_component:
                    mesh_component.set_static_mesh(static_mesh)
                    return True

        if prop_name == "Material" and actor_class_name == "StaticMeshActor":
            material = unreal.EditorAssetLibrary.load_asset(prop_value)
            if material:
                mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
                if mesh_component:
                    mesh_component.set_material(0, material)
                    return True

        if (
            prop_name == "Materials"
            and actor_class_name == "StaticMeshActor"
            and isinstance(prop_value, list)
        ):
            mesh_component = actor.get_component_by_class(unreal.StaticMeshComponent)
            if mesh_component:
                for index, material_path in enumerate(prop_value):
                    if not material_path:
                        continue

                    material = unreal.EditorAssetLibrary.load_asset(material_path)
                    if material:
                        mesh_component.set_material(index, material)
                return True
    except Exception:
        pass

    return set_object_property(actor, prop_name, prop_value)


def get_editor_property_value(target, prop_name, default=None):
    for candidate_name in get_property_name_candidates(prop_name):
        try:
            value = target.get_editor_property(candidate_name)
            if value is not None:
                return value
        except Exception:
            pass

        try:
            value = getattr(target, candidate_name)
            if value is not None:
                return value
        except Exception:
            pass

    return default
